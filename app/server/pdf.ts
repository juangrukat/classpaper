import type { Express, RequestHandler } from "express";
import puppeteer from "puppeteer-core";
import { randomBytes } from "node:crypto";
import { digest } from "./accounts.js";
import { query } from "./db.js";
let rendering = 0;
export function pdfRoutes(app: Express, auth: RequestHandler) {
  app.get("/api/tests/:id/pdf/:version", auth, async (req, res) => {
    const [doc] = await query<{
      doc: { settings: { paper: "A4" | "Letter" } };
    }>(
      "SELECT doc FROM print_versions WHERE version=$1 AND test_id=$2 AND user_id=$3",
      [req.params.version, req.params.id, res.locals.user.id],
    );
    if (!doc) {
      res.status(404).json({ error: "Print version not found." });
      return;
    }
    if (rendering >= 2) {
      res
        .status(503)
        .json({
          error: "Two documents are rendering. Please try again shortly.",
        });
      return;
    }
    const executablePath = process.env.CHROMIUM_PATH;
    if (!executablePath) {
      res
        .status(503)
        .json({
          error:
            "Server PDF rendering needs CHROMIUM_PATH. Browser printing is still available.",
        });
      return;
    }
    const mode = ["test", "key", "sheet"].includes(String(req.query.mode))
      ? String(req.query.mode)
      : "test";
    const origin = `http://127.0.0.1:${process.env.PORT || 3100}`;
    const raw = randomBytes(32).toString("hex");
    rendering++;
    let browser;
    try {
      await query(
        "INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,$3)",
        [digest(raw), res.locals.user.id, Date.now() + 60000],
      );
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args:
          process.env.CHROMIUM_NO_SANDBOX === "true"
            ? ["--no-sandbox", "--disable-dev-shm-usage"]
            : ["--disable-dev-shm-usage"],
        timeout: 15000,
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1000, height: 900 });
      await page.setCookie({
        name: "classpaper",
        value: raw,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      });
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (
          url.startsWith(origin + "/") ||
          url.startsWith("data:") ||
          url.startsWith("blob:")
        )
          void request.continue();
        else void request.abort();
      });
      await page.goto(
        `${origin}/print/${encodeURIComponent(String(req.params.id))}?v=${encodeURIComponent(String(req.params.version))}&mode=${mode}`,
        { waitUntil: "networkidle0", timeout: 30000 },
      );
      await page.waitForSelector('[data-print-ready="true"]', {
        timeout: 10000,
      });
      await page.emulateMediaType("print");
      const warnings = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".print-question")).flatMap(
          (el, i) => {
            const r = el.getBoundingClientRect();
            const issues: string[] = [];
            if (el.scrollWidth > el.clientWidth + 2)
              issues.push(`Question ${i + 1}: horizontal overflow.`);
            const pageHeight =
              (document
                .querySelector(".printed-paper")
                ?.getAttribute("data-paper") === "Letter"
                ? 279
                : 297) - 32;
            if (r.height > (pageHeight * 96) / 25.4)
              issues.push(
                `Question ${i + 1}: taller than a printable page; consider allowing page breaks.`,
              );
            return issues;
          },
        ),
      );
      if (req.query.check === "1") {
        res.json({ warnings });
        return;
      }
      const pdf = await page.pdf({
        format: doc.doc.settings.paper,
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 30000,
      });
      res
        .type("application/pdf")
        .setHeader(
          "Content-Disposition",
          `attachment; filename="classpaper-${mode}-${String(req.params.version).replace(/[^A-Z0-9]/gi, "")}.pdf"`,
        );
      res.send(Buffer.from(pdf));
    } catch (e) {
      console.error(
        "PDF rendering failed",
        e instanceof Error ? e.name : "error",
      );
      res
        .status(503)
        .json({
          error:
            "The PDF could not be rendered. Please use browser printing or try again.",
        });
    } finally {
      try {
        await browser?.close();
      } finally {
        await query("DELETE FROM sessions WHERE token=$1", [digest(raw)]);
        rendering--;
      }
    }
  });
}

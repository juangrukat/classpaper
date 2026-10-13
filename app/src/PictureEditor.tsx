import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "./common";
type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };
type Recipe = {
  angle: number;
  flip: boolean;
  brightness: number;
  contrast: number;
  crop: number;
  cropX: number;
  cropY: number;
  width: number;
  effect: string;
  annotation: string;
  textX: number;
  textY: number;
  color: string;
  strokes: Stroke[];
};
const initial: Recipe = {
  angle: 0,
  flip: false,
  brightness: 100,
  contrast: 100,
  crop: 100,
  cropX: 50,
  cropY: 50,
  width: 800,
  effect: "none",
  annotation: "",
  textX: 10,
  textY: 10,
  color: "#28594c",
  strokes: [],
};
export function PictureEditor({
  source,
  recipe = "",
  onClose,
  onSave,
}: {
  source: string;
  recipe?: string;
  onClose: () => void;
  onSave: (image: string, recipe: string) => void;
}) {
  const [r, setR] = useState<Recipe>(() => {
      try {
        const v = JSON.parse(recipe);
        const range = (
          n: unknown,
          min: number,
          max: number,
          fallback: number,
        ) =>
          typeof n === "number" && Number.isFinite(n)
            ? Math.max(min, Math.min(max, n))
            : fallback;
        return {
          ...initial,
          angle: range(v.angle, 0, 270, 0),
          flip: v.flip === true,
          brightness: range(v.brightness, 30, 170, 100),
          contrast: range(v.contrast, 30, 170, 100),
          crop: range(v.crop, 10, 100, 100),
          cropX: range(v.cropX, 0, 100, 50),
          cropY: range(v.cropY, 0, 100, 50),
          width: range(v.width, 100, 1600, 800),
          effect: ["none", "grayscale", "sepia"].includes(v.effect)
            ? v.effect
            : "none",
          annotation:
            typeof v.annotation === "string" ? v.annotation.slice(0, 150) : "",
          textX: range(v.textX, 0, 80, 10),
          textY: range(v.textY, 5, 95, 10),
          color: /^#[0-9a-f]{6}$/i.test(v.color || "")
            ? v.color
            : initial.color,
          strokes: Array.isArray(v.strokes)
            ? v.strokes.slice(0, 20).map((stroke: Stroke) => ({
                color: /^#[0-9a-f]{6}$/i.test(stroke.color || "")
                  ? stroke.color
                  : initial.color,
                points: Array.isArray(stroke.points)
                  ? stroke.points.slice(0, 1000).map((p) => ({
                      x: range(p.x, 0, 1, 0),
                      y: range(p.y, 0, 1, 0),
                    }))
                  : [],
              }))
            : [],
        };
      } catch {
        return initial;
      }
    }),
    [ready, setReady] = useState(false),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    active = useRef(false),
    paintedRecipe = useRef("");
  const set = (p: Partial<Recipe>) => setR((x) => ({ ...x, ...p }));
  useEffect(() => {
    setReady(false);
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const c = canvas.current;
      if (!c) return;
      const sw = (img.width * r.crop) / 100,
        sh = (img.height * r.crop) / 100,
        rotated = r.angle % 180 !== 0;
      const ratio = sw / sh;
      c.width = r.width;
      c.height = Math.min(
        3000,
        Math.round(rotated ? r.width * ratio : r.width / ratio),
      );
      const ctx = c.getContext("2d")!;
      ctx.save();
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((r.angle * Math.PI) / 180);
      ctx.scale(r.flip ? -1 : 1, 1);
      ctx.filter = `brightness(${r.brightness}%) contrast(${r.contrast}%) ${r.effect === "grayscale" ? "grayscale(1)" : r.effect === "sepia" ? "sepia(1)" : ""}`;
      const dw = rotated ? c.height : c.width,
        dh = rotated ? c.width : c.height;
      ctx.drawImage(
        img,
        ((img.width - sw) * r.cropX) / 100,
        ((img.height - sh) * r.cropY) / 100,
        sw,
        sh,
        -dw / 2,
        -dh / 2,
        dw,
        dh,
      );
      ctx.restore();
      ctx.lineWidth = Math.max(2, c.width / 220);
      ctx.lineCap = "round";
      for (const stroke of r.strokes) {
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        stroke.points.forEach((p, i) =>
          i
            ? ctx.lineTo(p.x * c.width, p.y * c.height)
            : ctx.moveTo(p.x * c.width, p.y * c.height),
        );
        ctx.stroke();
      }
      if (r.annotation) {
        ctx.fillStyle = r.color;
        ctx.font = `${Math.max(18, c.width / 28)}px sans-serif`;
        ctx.fillText(
          r.annotation,
          (c.width * r.textX) / 100,
          (c.height * r.textY) / 100,
        );
      }
      paintedRecipe.current = JSON.stringify(r);
      setReady(true);
    };
    img.onerror = () => setError("The picture could not be opened.");
    img.src = source;
    return () => {
      live = false;
    };
  }, [r, source]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x:
        Math.round(
          Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) *
            10000,
        ) / 10000,
      y:
        Math.round(
          Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) *
            10000,
        ) / 10000,
    };
  };
  return (
    <Modal title="Make the picture your own" wide onClose={onClose}>
      <p className="muted">
        The original is kept. You can reopen these edits or reset them at any
        time.
      </p>
      <div className="picture-canvas">
        <canvas
          ref={canvas}
          style={{
            touchAction: drawing ? "none" : "auto",
            cursor: drawing ? "crosshair" : "default",
          }}
          onPointerDown={(e) => {
            if (!drawing || r.strokes.length >= 20) return;
            active.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setR((x) => ({
              ...x,
              strokes: [...x.strokes, { color: x.color, points: [point(e)] }],
            }));
          }}
          onPointerMove={(e) => {
            if (!active.current) return;
            const p = point(e);
            setR((x) => {
              const strokes = [...x.strokes],
                last = strokes.at(-1);
              if (last && last.points.length < 1000)
                strokes[strokes.length - 1] = {
                  ...last,
                  points: [...last.points, p],
                };
              return { ...x, strokes };
            });
          }}
          onPointerUp={() => (active.current = false)}
        />
      </div>
      <div className="actions">
        <Button secondary onClick={() => set({ angle: (r.angle + 90) % 360 })}>
          Rotate 90°
        </Button>
        <Button secondary onClick={() => set({ flip: !r.flip })}>
          Flip
        </Button>
        <Button secondary onClick={() => setDrawing(!drawing)}>
          {drawing ? "Finish drawing" : "Draw on picture"}
        </Button>
        <Button
          secondary
          disabled={!r.strokes.length}
          onClick={() => set({ strokes: r.strokes.slice(0, -1) })}
        >
          Undo stroke
        </Button>
        <Button secondary onClick={() => setR(initial)}>
          Reset to original
        </Button>
      </div>
      <div className="form-grid">
        <label>
          Width in pixels
          <input
            type="number"
            min={100}
            max={1600}
            value={r.width}
            onChange={(e) =>
              set({
                width: Math.max(100, Math.min(1600, Number(e.target.value))),
              })
            }
          />
        </label>
        <label>
          Crop area: {r.crop}%
          <input
            type="range"
            min={10}
            max={100}
            value={r.crop}
            onChange={(e) => set({ crop: Number(e.target.value) })}
          />
        </label>
        <label>
          Brightness
          <input
            type="range"
            min={30}
            max={170}
            value={r.brightness}
            onChange={(e) => set({ brightness: Number(e.target.value) })}
          />
        </label>
        <label>
          Contrast
          <input
            type="range"
            min={30}
            max={170}
            value={r.contrast}
            onChange={(e) => set({ contrast: Number(e.target.value) })}
          />
        </label>
        <label>
          Color effect
          <select
            value={r.effect}
            onChange={(e) => set({ effect: e.target.value })}
          >
            <option value="none">Original colors</option>
            <option value="grayscale">Black and white</option>
            <option value="sepia">Sepia</option>
          </select>
        </label>
        <label>
          Drawing and text color
          <input
            type="color"
            value={r.color}
            onChange={(e) => set({ color: e.target.value })}
          />
        </label>
      </div>
      {r.crop < 100 && (
        <div className="form-grid">
          <label>
            Crop horizontal position
            <input
              type="range"
              min={0}
              max={100}
              value={r.cropX}
              onChange={(e) => set({ cropX: Number(e.target.value) })}
            />
          </label>
          <label>
            Crop vertical position
            <input
              type="range"
              min={0}
              max={100}
              value={r.cropY}
              onChange={(e) => set({ cropY: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
      <label>
        Text annotation
        <input
          value={r.annotation}
          onChange={(e) => set({ annotation: e.target.value })}
          maxLength={150}
          placeholder="e.g. Label this part"
        />
      </label>
      {r.annotation && (
        <div className="form-grid">
          <label>
            Text horizontal position
            <input
              type="range"
              min={0}
              max={80}
              value={r.textX}
              onChange={(e) => set({ textX: Number(e.target.value) })}
            />
          </label>
          <label>
            Text vertical position
            <input
              type="range"
              min={5}
              max={95}
              value={r.textY}
              onChange={(e) => set({ textY: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <Button
          disabled={!ready}
          onClick={() => {
            if (paintedRecipe.current !== JSON.stringify(r)) {
              setError(
                "The picture is still rendering. Please try again in a moment.",
              );
              return;
            }
            const image = canvas.current?.toDataURL("image/jpeg", 0.85);
            if (image) onSave(image, JSON.stringify(r));
          }}
        >
          Use this picture
        </Button>
      </div>
    </Modal>
  );
}

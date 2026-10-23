"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  getMechanicalMonitor,
  type MechanicalConvergencePoint,
  type MechanicalMonitorResponse,
  type MechanicalResourceSample,
} from "../lib/api";

const POLL_MS = 2500;
const MAX_LOG_CHARS = 200_000;
const MAX_CATCHUP = 40;

const SERIES = [
  { id: "force", label: "力收敛", valueKey: "force", criterionKey: "force_criterion", unit: "N" },
  { id: "disp", label: "位移收敛", valueKey: "disp", criterionKey: "disp_criterion", unit: "" },
  { id: "moment", label: "力矩收敛", valueKey: "moment", criterionKey: "moment_criterion", unit: "" },
  { id: "heat", label: "热流收敛", valueKey: "heat", criterionKey: "heat_criterion", unit: "" },
  { id: "rotation", label: "转角收敛", valueKey: "rotation", criterionKey: "rotation_criterion", unit: "" },
] as const;

type SeriesId = (typeof SERIES)[number]["id"];

interface Props {
  taskId: string;
  running: boolean;
}

function formatMb(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${Math.round(value)} MB`;
}

function formatSeconds(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`;
  return `${seconds} 秒`;
}

function formatCores(used?: number | null, requested?: number | null): string {
  if (used == null || !Number.isFinite(used)) return "-";
  const text = used.toFixed(1);
  if (requested != null && Number.isFinite(requested) && requested > 0) {
    return `${text} / ${requested} 核`;
  }
  return `${text} 核`;
}

function readNumber(point: MechanicalConvergencePoint, key: string): number | null {
  const value = (point as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSci(value: number): string {
  if (value >= 0.01 && value < 1000) {
    return String(Number(value.toPrecision(4)));
  }
  return value.toExponential(2);
}

function trimLog(text: string): string {
  if (text.length <= MAX_LOG_CHARS) return text;
  return text.slice(-MAX_LOG_CHARS);
}

function idleHint(snapshot: MechanicalMonitorResponse | null, running: boolean): string | null {
  const idle = snapshot?.log_idle_seconds;
  if (!running || idle == null || idle < 15) return null;
  const cpu = snapshot?.cpu_cores_used ?? 0;
  if (cpu >= 0.3) {
    return `求解器仍在计算，已经 ${Math.round(idle)} 秒没有新的日志。矩阵分解阶段经常这样。`;
  }
  return `已经 ${Math.round(idle)} 秒没有新的日志，CPU 占用也很低。`;
}

function ConvergenceChart({
  points,
  seriesId,
}: {
  points: MechanicalConvergencePoint[];
  seriesId: SeriesId;
}) {
  const series = SERIES.find((item) => item.id === seriesId) ?? SERIES[0];
  const [hover, setHover] = useState<{ x: number; y: number; point: MechanicalConvergencePoint } | null>(null);
  const width = 840;
  const height = 430;
  const left = 68;
  const right = 18;
  const top = 28;
  const plotBottom = 248;
  const timeTop = 292;
  const timeBottom = 392;

  const plotted = points.filter((point) => {
    const value = readNumber(point, series.valueKey);
    return value != null && value > 0;
  });

  const yValues = plotted.flatMap((point) => {
    const value = readNumber(point, series.valueKey);
    const criterion = readNumber(point, series.criterionKey);
    return [value, criterion].filter((item): item is number => item != null && item > 0);
  });

  if (plotted.length === 0 || yValues.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-emerald-300 bg-white px-4 py-8 text-sm text-gray-600">
        还没有{series.label}数据。线性静力和模态分析不会产生这条曲线；非线性求解进入平衡迭代后会画在这里。
      </div>
    );
  }

  const minExp = Math.floor(Math.log10(Math.min(...yValues)));
  const maxExpRaw = Math.ceil(Math.log10(Math.max(...yValues)));
  const maxExp = maxExpRaw === minExp ? minExp + 1 : maxExpRaw;
  const minI = plotted[0].i;
  const maxI = Math.max(plotted[plotted.length - 1].i, minI + 1);
  const plotWidth = width - left - right;
  const plotHeight = plotBottom - top;

  const xOf = (iteration: number) => left + ((iteration - minI) / (maxI - minI)) * plotWidth;
  const yOf = (value: number) => {
    const logValue = Math.log10(value);
    const ratio = (maxExp - logValue) / (maxExp - minExp);
    return top + Math.min(1, Math.max(0, ratio)) * plotHeight;
  };

  const segments = (key: string) => {
    const commands: string[] = [];
    let open = false;
    plotted.forEach((point) => {
      const value = readNumber(point, key);
      if (value == null || value <= 0) {
        open = false;
        return;
      }
      const command = `${open ? "L" : "M"}${xOf(point.i).toFixed(2)},${yOf(value).toFixed(2)}`;
      commands.push(command);
      open = true;
    });
    return commands.join(" ");
  };

  const yTicks: number[] = [];
  for (let exp = maxExp; exp >= minExp; exp -= 1) {
    yTicks.push(Math.pow(10, exp));
  }

  const xTicks = 4;
  const xLabels = Array.from({ length: xTicks + 1 }, (_, index) => {
    const iteration = Math.round(minI + ((maxI - minI) * index) / xTicks);
    return { iteration, x: xOf(iteration) };
  });

  const times = plotted.map((point) => point.t).filter((item): item is number => typeof item === "number" && item >= 0);
  const minTime = times.length ? Math.min(...times) : 0;
  const maxTime = times.length ? Math.max(...times, minTime + 1) : 1;
  const timeHeight = timeBottom - timeTop;
  const yTime = (value: number) => timeTop + (1 - (value - minTime) / (maxTime - minTime)) * timeHeight;
  const timePath = plotted
    .filter((point) => typeof point.t === "number")
    .map((point, index) => `${index === 0 ? "M" : "L"}${xOf(point.i).toFixed(2)},${yTime(point.t || 0).toFixed(2)}`)
    .join(" ");

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = width / rect.width;
    const svgX = (event.clientX - rect.left) * scale;
    if (svgX < left || svgX > width - right) {
      setHover(null);
      return;
    }
    const iteration = minI + ((svgX - left) / plotWidth) * (maxI - minI);
    let nearest = plotted[0];
    let distance = Math.abs(nearest.i - iteration);
    plotted.forEach((point) => {
      const next = Math.abs(point.i - iteration);
      if (next < distance) {
        nearest = point;
        distance = next;
      }
    });
    setHover({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      point: nearest,
    });
  };

  const hoverValue = hover ? readNumber(hover.point, series.valueKey) : null;
  const hoverCriterion = hover ? readNumber(hover.point, series.criterionKey) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <text x={left} y={16} fontSize="13" fill="#1f2937">
          {series.label}{series.unit ? ` (${series.unit})` : ""}
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={yOf(tick)} y2={yOf(tick)} stroke="#e5e7eb" />
            <text x={left - 8} y={yOf(tick) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
              {formatSci(tick)}
            </text>
          </g>
        ))}
        {plotted.map((point) => (
          <g key={`mark-${point.i}`}>
            {point.substep_converged ? (
              <line
                x1={xOf(point.i)}
                x2={xOf(point.i)}
                y1={top}
                y2={plotBottom}
                stroke="#22c55e"
                strokeDasharray="4 3"
                strokeWidth="1.2"
              />
            ) : null}
            {point.load_step_converged ? (
              <line
                x1={xOf(point.i)}
                x2={xOf(point.i)}
                y1={top}
                y2={plotBottom}
                stroke="#374151"
                strokeWidth="1.4"
              />
            ) : null}
          </g>
        ))}
        <path d={segments(series.criterionKey)} fill="none" stroke="#06b6d4" strokeWidth="2" />
        <path d={segments(series.valueKey)} fill="none" stroke="#7c3aed" strokeWidth="2" />
        <line x1={left} x2={width - right} y1={plotBottom} y2={plotBottom} stroke="#9ca3af" />
        <line x1={left} x2={left} y1={top} y2={plotBottom} stroke="#9ca3af" />
        {xLabels.map((tick) => (
          <text key={tick.iteration} x={tick.x} y={plotBottom + 16} textAnchor="middle" fontSize="11" fill="#6b7280">
            {tick.iteration}
          </text>
        ))}
        <text x={(left + width - right) / 2} y={plotBottom + 32} textAnchor="middle" fontSize="12" fill="#374151">
          累计迭代
        </text>

        <text x={left} y={timeTop - 8} fontSize="12" fill="#374151">已运行时间 (s)</text>
        <line x1={left} x2={width - right} y1={timeBottom} y2={timeBottom} stroke="#9ca3af" />
        <line x1={left} x2={left} y1={timeTop} y2={timeBottom} stroke="#9ca3af" />
        <path d={timePath} fill="none" stroke="#9f1239" strokeWidth="1.6" />
        <text x={left - 8} y={timeTop + 4} textAnchor="end" fontSize="11" fill="#6b7280">{Math.round(maxTime)}</text>
        <text x={left - 8} y={timeBottom} textAnchor="end" fontSize="11" fill="#6b7280">{Math.round(minTime)}</text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-violet-600" /> {series.label}</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-cyan-500" /> 收敛准则</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 border-l border-dashed border-green-500" /> 子步收敛</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 border-l border-gray-700" /> 载荷步收敛</span>
      </div>
      {hover && hoverValue != null ? (
        <div
          className="pointer-events-none absolute z-10 rounded border border-gray-200 bg-white px-2 py-1 text-xs shadow"
          style={{ left: Math.min(hover.x + 12, 360), top: Math.max(8, hover.y - 48) }}
        >
          <div>迭代 {hover.point.i}</div>
          <div>{series.label} {formatSci(hoverValue)}{series.unit ? ` ${series.unit}` : ""}</div>
          {hoverCriterion != null ? <div>准则 {formatSci(hoverCriterion)}</div> : null}
          {hover.point.t != null ? <div>已运行 {formatSeconds(hover.point.t)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 220;
  const height = 36;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-9 w-full">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export default function MechanicalMonitorPanel({ taskId, running }: Props) {
  const [logText, setLogText] = useState("");
  const [snapshot, setSnapshot] = useState<MechanicalMonitorResponse | null>(null);
  const [points, setPoints] = useState<MechanicalConvergencePoint[]>([]);
  const [resources, setResources] = useState<MechanicalResourceSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [seriesId, setSeriesId] = useState<SeriesId>("force");
  const offsetRef = useRef(-1);
  const catchupRef = useRef(0);
  const followRef = useRef(true);
  const runningRef = useRef(running);
  const logRef = useRef<HTMLPreElement | null>(null);
  runningRef.current = running;
  followRef.current = following;

  const pull = useCallback(async () => {
    const previousOffset = offsetRef.current;
    const data = await getMechanicalMonitor(taskId, previousOffset);
    offsetRef.current = data.log_offset;
    setSnapshot(data);
    setPoints(data.convergence || []);
    setResources(data.resources || []);
    const replaceLog = data.log_reset || previousOffset < 0;
    setLogText((current) => trimLog(replaceLog ? data.log_text : current + (data.log_text || "")));
    setError(null);
    const pending = data.log_offset < data.log_size;
    if (pending && catchupRef.current < MAX_CATCHUP) {
      catchupRef.current += 1;
      return 0;
    }
    catchupRef.current = 0;
    return runningRef.current ? POLL_MS : -1;
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const loop = async () => {
      let delay = POLL_MS;
      try {
        delay = await pull();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "读取求解过程失败");
        }
        delay = runningRef.current ? POLL_MS : -1;
      }
      if (cancelled || delay < 0) return;
      timer = window.setTimeout(() => {
        void loop();
      }, delay);
    };
    void loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pull, running]);

  useEffect(() => {
    const box = logRef.current;
    if (box && followRef.current) {
      box.scrollTop = box.scrollHeight;
    }
  }, [logText]);

  const availableSeries = useMemo(
    () => SERIES.filter((series) => points.some((point) => {
      const value = readNumber(point, series.valueKey);
      return value != null && value > 0;
    })),
    [points]
  );

  useEffect(() => {
    if (availableSeries.length === 0) return;
    if (!availableSeries.some((series) => series.id === seriesId)) {
      setSeriesId(availableSeries[0].id);
    }
  }, [availableSeries, seriesId]);

  const cpuSeries = resources.map((item) => item.cpu).filter((item): item is number => typeof item === "number");
  const memorySeries = resources.map((item) => item.memory_mb).filter((item): item is number => typeof item === "number");
  const hint = idleHint(snapshot, running);
  const logHref = `${API_BASE}/tasks/${taskId}/solver-log`;

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-emerald-950">求解过程</div>
          <div className="text-xs text-gray-500">日志来自 MAPDL 的 .out，资源和收敛在求解中约每 2.5 秒刷新。</div>
        </div>
        <a
          href={logHref}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
        >
          下载完整日志
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-xs text-emerald-800">CPU</div>
          <div className="text-sm font-semibold text-emerald-950">
            {formatCores(snapshot?.cpu_cores_used, snapshot?.cpu_cores_requested)}
          </div>
          <Sparkline values={cpuSeries} color="#047857" />
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-xs text-emerald-800">求解内存</div>
          <div className="text-sm font-semibold text-emerald-950">{formatMb(snapshot?.memory_mb)}</div>
          <div className="text-xs text-emerald-800">本机剩余 {formatMb(snapshot?.host_memory_available_mb)}</div>
          <Sparkline values={memorySeries} color="#0f766e" />
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-xs text-emerald-800">载荷步 / 子步</div>
          <div className="text-sm font-semibold text-emerald-950">
            {snapshot?.load_step ?? "-"} / {snapshot?.substep ?? "-"}
          </div>
          <div className="text-xs text-emerald-800">
            子步内迭代 {snapshot?.iteration ?? "-"} · 累计 {snapshot?.cumulative_iteration ?? "-"}
          </div>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-xs text-emerald-800">已运行</div>
          <div className="text-sm font-semibold text-emerald-950">{formatSeconds(snapshot?.elapsed_seconds)}</div>
          <div className="text-xs text-emerald-800">
            {running ? "求解进行中" : "求解已结束，下面仍可回看"}
          </div>
        </div>
      </div>

      {hint ? <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{hint}</div> : null}
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}

      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-700">收敛曲线</span>
          {availableSeries.map((series) => (
            <button
              key={series.id}
              type="button"
              onClick={() => setSeriesId(series.id)}
              className={`rounded px-2 py-0.5 text-xs ${
                seriesId === series.id ? "bg-violet-100 text-violet-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {series.label}
            </button>
          ))}
          {snapshot?.convergence_truncated ? (
            <span className="text-xs text-gray-500">迭代很多，图上保留最近 {points.length} 个点</span>
          ) : null}
        </div>
        <ConvergenceChart points={points} seriesId={availableSeries.some((item) => item.id === seriesId) ? seriesId : (availableSeries[0]?.id || "force")} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">求解日志</span>
          {!following ? (
            <button
              type="button"
              className="text-xs text-emerald-700 hover:underline"
              onClick={() => {
                setFollowing(true);
                const box = logRef.current;
                if (box) box.scrollTop = box.scrollHeight;
              }}
            >
              回到最新
            </button>
          ) : (
            <span className="text-xs text-gray-400">跟随最新</span>
          )}
        </div>
        <pre
          ref={logRef}
          onScroll={(event) => {
            const box = event.currentTarget;
            const stuck = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
            setFollowing(stuck);
          }}
          className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs leading-5 text-gray-800"
        >
          {logText || "求解日志还未生成。MAPDL 开始写 .out 之后会出现在这里。"}
        </pre>
      </div>
    </div>
  );
}

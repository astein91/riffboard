import { useMemo, useRef, useEffect } from "react";
import { useTranscriptStore, TranscriptSegment } from "../stores/transcript";

interface SpeakerGroup {
  speaker: number;
  text: string;
  id: string;
}

function groupBySpeaker(segments: TranscriptSegment[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.text += " " + seg.text;
    } else {
      groups.push({ speaker: seg.speaker, text: seg.text, id: seg.id });
    }
  }
  return groups;
}

// Muted bubble backgrounds derived from speaker colors
const BUBBLE_COLORS = [
  "rgba(96,165,250,0.15)",  // blue
  "rgba(244,114,182,0.15)", // pink
  "rgba(74,222,128,0.15)",  // green
  "rgba(251,191,36,0.15)",  // amber
  "rgba(167,139,250,0.15)", // purple
  "rgba(251,146,60,0.15)",  // orange
  "rgba(45,212,191,0.15)",  // teal
  "rgba(248,113,113,0.15)", // red
];

const BUBBLE_BORDERS = [
  "rgba(96,165,250,0.3)",
  "rgba(244,114,182,0.3)",
  "rgba(74,222,128,0.3)",
  "rgba(251,191,36,0.3)",
  "rgba(167,139,250,0.3)",
  "rgba(251,146,60,0.3)",
  "rgba(45,212,191,0.3)",
  "rgba(248,113,113,0.3)",
];

function Bubble({
  speaker,
  children,
  dimmed,
}: {
  speaker: number;
  children: React.ReactNode;
  dimmed?: boolean;
}) {
  const info = useTranscriptStore((s) => s.speakers[speaker]);
  const isEven = speaker % 2 === 0;
  const bg = BUBBLE_COLORS[speaker % BUBBLE_COLORS.length];
  const border = BUBBLE_BORDERS[speaker % BUBBLE_BORDERS.length];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isEven ? "flex-start" : "flex-end",
        marginBottom: 6,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: info?.color ?? "#888",
          marginBottom: 2,
          paddingLeft: isEven ? 8 : 0,
          paddingRight: isEven ? 0 : 8,
        }}
      >
        {info?.name ?? `Speaker ${speaker}`}
      </span>
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: isEven ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
          padding: "6px 10px",
          maxWidth: "85%",
          fontSize: 13,
          lineHeight: "1.5",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function TranscriptOverlay() {
  const segments = useTranscriptStore((s) => s.segments);
  const flushedCount = useTranscriptStore((s) => s.flushedCount);
  const interimSegment = useTranscriptStore((s) => s.interimSegment);
  const scrollRef = useRef<HTMLDivElement>(null);

  const committedSegments = segments.slice(0, flushedCount);
  const liveSegments = segments.slice(flushedCount);

  const historyGroups = useMemo(
    () => groupBySpeaker(committedSegments).slice(-3),
    [committedSegments],
  );
  const liveGroups = useMemo(() => groupBySpeaker(liveSegments), [liveSegments]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [historyGroups, liveGroups, interimSegment]);

  const interimText = interimSegment?.text ?? "";
  const interimSpeaker =
    interimSegment?.speaker ??
    liveSegments[liveSegments.length - 1]?.speaker ??
    committedSegments[committedSegments.length - 1]?.speaker ??
    0;

  const lastLiveGroup = liveGroups[liveGroups.length - 1];
  const interimMergesWithLive = lastLiveGroup && lastLiveGroup.speaker === interimSpeaker;

  const hasContent = segments.length > 0 || interimText;

  return (
    <div ref={scrollRef}>
      {/* Committed history */}
      {historyGroups.map((g) => (
        <Bubble key={g.id} speaker={g.speaker} dimmed>
          <span style={{ color: "#aaa" }}>{g.text}</span>
        </Bubble>
      ))}

      {/* Live utterance */}
      {liveGroups.map((g, i) => {
        const isLast = i === liveGroups.length - 1;
        return (
          <Bubble key={g.id} speaker={g.speaker}>
            <span style={{ color: "#e5e5e5" }}>{g.text}</span>
            {isLast && interimMergesWithLive && interimText && (
              <span style={{ color: "#999", fontStyle: "italic" }}> {interimText}</span>
            )}
          </Bubble>
        );
      })}

      {/* Interim on its own bubble if different speaker or no live segments */}
      {interimText && !interimMergesWithLive && (
        <Bubble speaker={interimSpeaker}>
          <span style={{ color: "#999", fontStyle: "italic" }}>{interimText}</span>
        </Bubble>
      )}

      {/* Listening indicator when no content yet */}
      {!hasContent && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, color: "#666", fontSize: 13, paddingTop: 40,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#f59e0b",
            display: "inline-block", animation: "pulse 1.5s ease-in-out infinite",
          }} />
          Listening...
        </div>
      )}
    </div>
  );
}

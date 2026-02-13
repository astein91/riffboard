import { useTranscriptStore } from "../stores/transcript";

export function MicButton() {
  const micStatus = useTranscriptStore((s) => s.micStatus);
  const error = useTranscriptStore((s) => s.error);
  const startMic = useTranscriptStore((s) => s.startMic);
  const stopMic = useTranscriptStore((s) => s.stopMic);

  const isOn = micStatus === "on";
  const isRequesting = micStatus === "requesting";
  const isError = micStatus === "error";

  const handleClick = () => {
    if (isOn || isRequesting) stopMic();
    else startMic();
  };

  return (
    <button
      onClick={handleClick}
      title={isError ? error ?? "Microphone error" : isOn ? "Stop recording" : "Start recording"}
      style={{
        background: isOn ? "#dc2626" : isError ? "#7f1d1d" : "#222",
        border: "none",
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        fontSize: 16,
        flexShrink: 0,
        opacity: isRequesting ? 0.5 : 1,
        position: "relative",
        lineHeight: 1,
      }}
    >
      {isOn ? "\u{1F534}" : "\u{1F3A4}"}
    </button>
  );
}

import { useEffect, useState } from "react";

let push: ((message: string) => void) | null = null;

export function showToast(message: string) {
  push?.(message);
}

export function Toaster() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    push = (next) => {
      setMessage(next);
      window.setTimeout(() => {
        setMessage((current) => (current === next ? "" : current));
      }, 2800);
    };
    return () => {
      push = null;
    };
  }, []);

  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

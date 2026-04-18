import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useSpeechInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const sanitizePii = (text: string): string => {
    return text
      // SSN: 123-45-6789 or 123456789
      .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[SSN REMOVED]")
      // Account numbers: 8-16 digit strings
      .replace(/\b\d{8,16}\b/g, "[ACCOUNT# REMOVED]")
      // Phone numbers
      .replace(
        /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        "[PHONE REMOVED]"
      )
      // Email addresses
      .replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "[EMAIL REMOVED]"
      )
      // Date of birth patterns MM/DD/YYYY or MM-DD-YYYY
      .replace(
        /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
        "[DOB REMOVED]"
      );
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const sanitized = sanitizePii(transcript);

      if (sanitized !== transcript) {
        toast.warning("Some sensitive information was removed before sending", {
          duration: 3000,
        });
      }

      onResult(sanitized);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error(
          "Microphone access denied. Please allow microphone permission in your browser."
        );
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, isSupported, startListening, stopListening };
}

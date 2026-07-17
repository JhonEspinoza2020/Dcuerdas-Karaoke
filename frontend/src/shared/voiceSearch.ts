type SpeechRecognitionResultLike = {
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export function startVoiceSearch(options: {
  readonly onResult: (text: string) => void;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  readonly onError?: () => void;
}): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    options.onError?.();
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = "es-PE";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const text = last?.[0]?.transcript?.trim();
    if (text) options.onResult(text);
  };
  recognition.onerror = () => options.onError?.();
  recognition.onend = () => options.onEnd?.();
  options.onStart?.();
  recognition.start();

  return () => recognition.stop();
}

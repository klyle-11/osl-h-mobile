"use client";
// @ts-nocheck
import React from "react";

type Props = {
  onFile: (file: File) => void;
};

export default function FileUpload({ onFile }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onChange = (e: any) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={onChange}
        className="hidden"
      />
      <button
        className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 text-base font-medium"
        onClick={() => inputRef.current?.click()}
      >
        Upload EPUB
      </button>
    </div>
  );
}

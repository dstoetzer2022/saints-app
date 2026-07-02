import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Play, Upload, X, Loader2 } from "lucide-react";

// TODO: replace with Derek's Cloudinary cloud name + an UNSIGNED upload preset
// created in the Cloudinary console (Settings > Upload > Upload presets > Add,
// Signing Mode: Unsigned). Scope the preset to a folder like "pitcher-video/".
const CLOUDINARY_CLOUD_NAME = "dpsbfigoq";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

async function uploadToCloudinary(file, onProgress) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", "pitcher-video");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          video_url: data.secure_url,
          video_thumbnail_url: data.secure_url.replace(/\.[^.]+$/, ".jpg"),
        });
      } else {
        reject(new Error(`Cloudinary upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Cloudinary upload failed (network error)"));
    xhr.send(form);
  });
}

function VideoModal({ videoUrl, pitchType, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white"
          aria-label="Close video"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-white/70 text-xs uppercase tracking-wider mb-2">{pitchType}</div>
        <video src={videoUrl} controls autoPlay className="w-full rounded-lg bg-black" />
      </div>
    </div>
  );
}

// arsenalId: id of the season-scope PitcherArsenal record to write video fields onto.
export default function PitchVideoCell({ pitchType, videoUrl, thumbnailUrl, arsenalId, onUploaded }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !arsenalId) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const { video_url, video_thumbnail_url } = await uploadToCloudinary(file, setProgress);
      await base44.entities.PitcherArsenal.update(arsenalId, { video_url, video_thumbnail_url });
      onUploaded && onUploaded({ video_url, video_thumbnail_url });
    } catch (err) {
      console.error(err);
      setError("Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {progress}%
      </div>
    );
  }

  if (videoUrl) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/70 transition-colors"
          aria-label={`Play ${pitchType} video`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
        {modalOpen && (
          <VideoModal videoUrl={videoUrl} pitchType={pitchType} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={!arsenalId}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-muted-foreground/40 hover:border-muted-foreground transition-colors disabled:opacity-30"
        aria-label={`Upload ${pitchType} video`}
        title={arsenalId ? "Upload clip" : "No season row for this pitch type yet"}
      >
        <Upload className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-[10px] text-destructive mt-1">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

import React from 'react';
import { Exercise } from '../types';

// Detects vertical (9:16) YouTube Shorts
export const isYouTubeShort = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes('/shorts/');
};

// Helper to extract YouTube video ID and thumbnail
export const getYouTubeThumbnail = (url: string | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  // Match YouTube URLs: watch?v=, embed/, v/, shorts/, youtu.be/, with optional query params
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?(?:.*&)?v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    // YouTube Shorts do not have maxresdefault, go straight to hqdefault
    if (isYouTubeShort(trimmed)) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    // Use maxresdefault (1280x720) for clean fill in square crops.
    // onYTThumbLoad and onYTThumbError cascade to hqdefault → mqdefault → muscle group if 404 or placeholder.
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }
  return null;
};

// Helper to get exercise cover image (prefers YouTube thumbnail only)
export const getExerciseCoverImage = (libEx?: Exercise): string => {
  if (!libEx) return '';
  const ytThumb = getYouTubeThumbnail(libEx.videoUrl);
  if (ytThumb) return ytThumb;
  return '';
};

// Helper when image loads: YouTube returns a 120x90 placeholder JPEG when maxresdefault/hqdefault is missing.
// Modern browsers fire onLoad (not onError) because the payload is valid JPEG.
// Checking naturalWidth <= 120 detects this placeholder immediately.
export const onYTThumbLoad = () =>
  (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 120) {
      if (img.src.includes('/maxresdefault.jpg')) {
        img.src = img.src.replace('/maxresdefault.jpg', '/hqdefault.jpg');
      } else if (img.src.includes('/hqdefault.jpg')) {
        img.src = img.src.replace('/hqdefault.jpg', '/mqdefault.jpg');
      } else {
        img.style.display = 'none';
      }
    }
  };

// Fallback handler: cascades gracefully maxresdefault → hqdefault → mqdefault → hide
export const onYTThumbError = () =>
  (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src.includes('/maxresdefault.jpg')) {
      img.src = img.src.replace('/maxresdefault.jpg', '/hqdefault.jpg');
    } else if (img.src.includes('/hqdefault.jpg')) {
      img.src = img.src.replace('/hqdefault.jpg', '/mqdefault.jpg');
    } else {
      img.style.display = 'none';
    }
  };

// Helper to convert any video URL into an embedded player
export const getEmbedVideo = (url: string | undefined): { type: 'youtube' | 'vimeo' | 'direct'; src: string; thumbnail?: string } | null => {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube match
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?(?:.*&)?v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      type: 'youtube',
      src: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&showinfo=0&disablekb=1`,
      thumbnail: isYouTubeShort(trimmed)
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };
  }

  // Vimeo match
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    };
  }

  // Direct MP4 / WebM
  if (/\.(mp4|webm|ogg|mov)(?:\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct',
      src: trimmed
    };
  }

  return null;
};

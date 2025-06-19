"use client";

import gsap from "gsap";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsFillPaletteFill } from "react-icons/bs";
import {
  FiCheck,
  FiCopy,
  FiDownload,
  FiGithub,
  FiSettings,
} from "react-icons/fi";
import { RiQrCodeLine, RiRulerLine } from "react-icons/ri";

// Definición de tipos
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type TabType = "config" | "appearance";
type ImageFormat = "png" | "jpeg" | "svg";

// Constantes para evitar magic numbers
const MIN_QR_SIZE = 128;
const MAX_QR_SIZE = 3000;
const PREVIEW_SCALE_FACTOR = 0.2;
const MAX_PREVIEW_SIZE = 400;
const DEFAULT_QR_SETTINGS = {
  size: 800,
  bgColor: "#ffffff",
  fgColor: "#000000",
  level: "Q" as ErrorCorrectionLevel,
  includeMargin: false,
};

export default function QRGenerator() {
  // Estados
  const [text, setText] = useState("");
  const [size, setSize] = useState(DEFAULT_QR_SETTINGS.size);
  const [bgColor, setBgColor] = useState(DEFAULT_QR_SETTINGS.bgColor);
  const [fgColor, setFgColor] = useState(DEFAULT_QR_SETTINGS.fgColor);
  const [level, setLevel] = useState<ErrorCorrectionLevel>(
    DEFAULT_QR_SETTINGS.level
  );
  const [includeMargin, setIncludeMargin] = useState(
    DEFAULT_QR_SETTINGS.includeMargin
  );
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("config");
  const [imageFormat, setImageFormat] = useState<ImageFormat>("png");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrPreviewRef = useRef<HTMLDivElement>(null);
  const downloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validación de color hexadecimal
  const isValidHexColor = (color: string) =>
    /^#([0-9A-F]{3}){1,2}$/i.test(color);

  // Animaciones iniciales
  useEffect(() => {
    const animation = gsap.from(qrContainerRef.current, {
      opacity: 0,
      y: 40,
      duration: 0.9,
      ease: "elastic.out(1, 0.5)",
    });

    return () => {
      animation.kill();
    };
  }, []);

  // Ajustar vista previa con animación
  useEffect(() => {
    if (qrPreviewRef.current) {
      const previewSize = Math.min(
        size * PREVIEW_SCALE_FACTOR,
        MAX_PREVIEW_SIZE
      );
      gsap.to(qrPreviewRef.current, {
        width: `${previewSize + 32}px`,
        height: `${previewSize + 32}px`,
        duration: 0.4,
        ease: "power3.out",
      });
    }
  }, [size]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        clearTimeout(downloadTimerRef.current);
      }
    };
  }, []);

  // Generar SVG optimizado
  const generateSVG = useCallback(() => {
    try {
      const svgSize = Math.min(size, MAX_QR_SIZE);
      const qrSize = svgSize - (includeMargin ? 40 : 0);

      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
          <rect width="100%" height="100%" fill="${bgColor}"/>
          <path d="M${includeMargin ? 20 : 0},${
        includeMargin ? 20 : 0
      } h${qrSize} v${qrSize} h-${qrSize} z" fill="${fgColor}"/>
        </svg>
      `;

      return new Blob([svgContent], { type: "image/svg+xml" });
    } catch (err) {
      console.error("Error generating SVG:", err);
      setError("Error al generar el SVG");
      throw err;
    }
  }, [size, bgColor, fgColor, includeMargin]);

  // Manejar descarga
  const handleDownload = useCallback(async () => {
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      if (imageFormat === "svg") {
        const svgBlob = generateSVG();
        const url = URL.createObjectURL(svgBlob);
        triggerDownload(url, `qr-${Date.now()}.svg`);
        return;
      }

      // Para PNG/JPEG usamos un canvas temporal de alta resolución
      const tempCanvas = document.createElement("canvas");
      const tempSize = Math.min(size, MAX_QR_SIZE);
      tempCanvas.width = tempSize;
      tempCanvas.height = tempSize;

      const ctx = tempCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("No se pudo obtener el contexto del canvas");
      }

      // Fondo
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, tempSize, tempSize);

      // Renderizar QR en un elemento temporal
      const qrWrapper = document.createElement("div");
      qrWrapper.style.position = "fixed";
      qrWrapper.style.left = "-9999px";
      document.body.appendChild(qrWrapper);

      const { createRoot } = await import("react-dom/client");
      const root = createRoot(qrWrapper);

      root.render(
        <QRCodeCanvas
          value={text}
          size={Math.min(tempSize * 0.9, tempSize - 40)}
          bgColor={bgColor}
          fgColor={fgColor}
          level={level}
          includeMargin={includeMargin}
        />
      );

      // Esperar a que React renderice el componente
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const qrCanvas = qrWrapper.querySelector("canvas");
        if (!qrCanvas) {
          throw new Error("No se pudo generar el código QR");
        }

        const qrSize = Math.min(tempSize * 0.9, tempSize - 40);
        const qrX = (tempSize - qrSize) / 2;
        const qrY = (tempSize - qrSize) / 2;

        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        tempCanvas.toBlob(
          (blob) => {
            if (!blob) {
              throw new Error("No se pudo generar el blob de imagen");
            }
            const url = URL.createObjectURL(blob);
            triggerDownload(url, `qr-${Date.now()}.${imageFormat}`);
          },
          imageFormat === "png" ? "image/png" : "image/jpeg",
          1.0
        );
      } finally {
        document.body.removeChild(qrWrapper);
        root.unmount();
      }
    } catch (err) {
      console.error("Error generating QR:", err);
      setError("Error al generar el código QR. Inténtalo de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  }, [
    text,
    size,
    bgColor,
    fgColor,
    level,
    includeMargin,
    imageFormat,
    generateSVG,
  ]);

  // Función auxiliar para descargar
  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar después de 100ms
    downloadTimerRef.current = setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Copiar al portapapeles
  const copyToClipboard = useCallback(async () => {
    if (!text.trim() || isCopied || isGenerating) return;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      gsap.to(".copy-indicator", {
        scale: 1.2,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar: ", err);
      setError("No se pudo copiar al portapapeles");
    }
  }, [text, isCopied, isGenerating]);

  // Restablecer colores
  const resetColors = useCallback(() => {
    gsap.to([".color-preview-fg", ".color-preview-bg"], {
      backgroundColor: DEFAULT_QR_SETTINGS.fgColor,
      duration: 0.3,
      onComplete: () => {
        setFgColor(DEFAULT_QR_SETTINGS.fgColor);
        setBgColor(DEFAULT_QR_SETTINGS.bgColor);
        gsap.to(".color-preview-bg", {
          backgroundColor: DEFAULT_QR_SETTINGS.bgColor,
          duration: 0.3,
        });
      },
    });
  }, []);

  // Manejar cambio de tamaño con validación
  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    if (!isNaN(newSize)) {
      const clampedSize = Math.max(MIN_QR_SIZE, Math.min(newSize, MAX_QR_SIZE));
      setSize(clampedSize);

      // Animación del indicador de tamaño
      gsap.to(".size-indicator", {
        scale: 1.1,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      });
    }
  };

  // Manejar cambio de color con validación
  const handleColorChange = (colorType: "fg" | "bg", value: string) => {
    if (isValidHexColor(value)) {
      if (colorType === "fg") {
        setFgColor(value);
      } else {
        setBgColor(value);
      }
    }
  };

  // Presets de colores
  const colorPresets = [
    { fg: "#000000", bg: "#ffffff", label: "Clásico", name: "black" },
    { fg: "#1e40af", bg: "#e0e7ff", label: "Azul", name: "blue" },
    { fg: "#166534", bg: "#dcfce7", label: "Verde", name: "green" },
    { fg: "#9d174d", bg: "#fce7f3", label: "Rosa", name: "pink" },
    { fg: "#854d0e", bg: "#fef9c3", label: "Ámbar", name: "amber" },
    { fg: "#5b21b6", bg: "#ede9fe", label: "Violeta", name: "violet" },
    { fg: "#0f766e", bg: "#ccfbf1", label: "Turquesa", name: "teal" },
    { fg: "#9f1239", bg: "#ffe4e6", label: "Rojo", name: "red" },
  ];

  // Opciones de nivel de corrección
  const errorLevelOptions = [
    { value: "L", label: "Bajo (7%)", desc: "Más pequeño" },
    { value: "M", label: "Medio (15%)", desc: "Balanceado" },
    { value: "Q", label: "Alto (25%)", desc: "Recomendado" },
    { value: "H", label: "Máximo (30%)", desc: "Más robusto" },
  ];

  // Opciones de formato de imagen
  const imageFormatOptions = [
    { value: "png", label: "PNG", desc: "Alta calidad" },
    { value: "jpeg", label: "JPEG", desc: "Compresión" },
    { value: "svg", label: "SVG", desc: "Vectorial escalable" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-amber-50 flex items-center justify-center p-4">
      <div
        ref={qrContainerRef}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden transition-all hover:shadow-3xl"
      >
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48cGF0aCBkPSJNMzAgMTVjLTguMjkgMC0xNSA2LjcxLTE1IDE1IDAgOC4yOSA2LjcxIDE1IDE1IDE1czE1LTYuNzEgMTUtMTVjMC04LjI5LTYuNzEtMTUtMTUtMTV6bTAgMjVjLTUuNTIgMC0xMC00LjQ4LTEwLTEwIDAtNS41MiA0LjQ4LTEwIDEwLTEwczEwIDQuNDggMTAgMTBjMCA1LjUyLTQuNDggMTAtMTAgMTB6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')]"></div>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiQrCodeLine
                size={32}
                className="text-amber-200 animate-pulse"
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">QRs JLuu</h1>
                <p className="text-amber-100 mt-1 text-sm font-medium">
                  Generador profesional de códigos QR de alta resolución
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                window.open(
                  "https://github.com/mendozaro25/generador-qr",
                  "_blank"
                )
              }
              className="p-2 rounded-full hover:bg-amber-700/30 transition-all transform hover:scale-110"
              aria-label="Código fuente en GitHub"
              title="Código fuente en GitHub"
            >
              <FiGithub size={22} />
            </button>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex flex-col xl:flex-row">
          {/* Panel de configuración */}
          <div className="w-full xl:w-1/2 p-8 border-r border-gray-100">
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`py-3 px-5 font-medium text-sm flex items-center gap-2 transition-all ${
                  activeTab === "config"
                    ? "text-amber-600 border-b-2 border-amber-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("config")}
              >
                <FiSettings size={18} className="flex-shrink-0" />
                Configuración
              </button>
              <button
                className={`py-3 px-5 font-medium text-sm flex items-center gap-2 transition-all ${
                  activeTab === "appearance"
                    ? "text-amber-600 border-b-2 border-amber-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("appearance")}
              >
                <BsFillPaletteFill size={18} className="flex-shrink-0" />
                Apariencia
              </button>
            </div>

            {activeTab === "config" ? (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Contenido del código QR
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-gray-800 shadow-sm"
                      placeholder="https://ejemplo.com o cualquier texto"
                      maxLength={1000}
                    />
                    <button
                      onClick={copyToClipboard}
                      disabled={!text.trim()}
                      className={`px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm ${
                        text.trim()
                          ? "bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                          : "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                      title={isCopied ? "¡Copiado!" : "Copiar al portapapeles"}
                    >
                      <span className="copy-indicator inline-block">
                        {isCopied ? (
                          <FiCheck size={18} />
                        ) : (
                          <FiCopy size={18} />
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <RiRulerLine size={18} className="text-gray-500" />
                    <span>Tamaño del código QR</span>
                    <span className="size-indicator ml-auto bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                      {size}px
                    </span>
                  </label>
                  <div className="flex items-center gap-5">
                    <input
                      type="range"
                      min={MIN_QR_SIZE.toString()}
                      max={MAX_QR_SIZE.toString()}
                      step="8"
                      value={size}
                      onChange={handleSizeChange}
                      className="flex-1 h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-amber-600 shadow-inner"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                    <span>Pequeño</span>
                    <span>Mediano</span>
                    <span>Grande</span>
                    <span className="font-bold text-amber-600">Ultra HD</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Nivel de corrección
                    </label>
                    <div className="space-y-2">
                      {errorLevelOptions.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="radio"
                            name="errorLevel"
                            value={option.value}
                            checked={level === option.value}
                            onChange={() =>
                              setLevel(option.value as ErrorCorrectionLevel)
                            }
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">
                              {option.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {option.desc}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Formato de descarga
                    </label>
                    <div className="space-y-2">
                      {imageFormatOptions.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="radio"
                            name="imageFormat"
                            value={option.value}
                            checked={imageFormat === option.value}
                            onChange={() =>
                              setImageFormat(option.value as ImageFormat)
                            }
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">
                              {option.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {option.desc}
                            </div>
                          </div>
                          {option.value === "svg" && (
                            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-bold">
                              HD
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      id="includeMargin"
                      checked={includeMargin}
                      onChange={(e) => setIncludeMargin(e.target.checked)}
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="font-medium text-gray-800">
                        Incluir margen blanco
                      </div>
                      <div className="text-xs text-gray-500">
                        Espacio alrededor del código QR
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Color frontal
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="color"
                          value={fgColor}
                          onChange={(e) =>
                            handleColorChange("fg", e.target.value)
                          }
                          className="w-12 h-12 cursor-pointer rounded-xl border-2 border-gray-300 appearance-none bg-transparent shadow-sm"
                          style={{ WebkitAppearance: "none" }}
                        />
                        <div
                          className="absolute inset-0 rounded-xl border border-gray-200 pointer-events-none overflow-hidden"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml;charset=utf-8,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h8v8H0zm8 8h8v8H8z' fill='%23e5e7eb'/%3E%3C/svg%3E\")",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 mb-1">
                          Código hexadecimal
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={fgColor}
                            onChange={(e) =>
                              handleColorChange("fg", e.target.value)
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-mono shadow-sm"
                            maxLength={7}
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                          <div
                            className="color-preview-fg w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                            style={{ backgroundColor: fgColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Color de fondo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) =>
                            handleColorChange("bg", e.target.value)
                          }
                          className="w-12 h-12 cursor-pointer rounded-xl border-2 border-gray-300 appearance-none bg-transparent shadow-sm"
                          style={{ WebkitAppearance: "none" }}
                        />
                        <div
                          className="absolute inset-0 rounded-xl border border-gray-200 pointer-events-none overflow-hidden"
                          style={{
                            backgroundImage:
                              "url(\"data:image/svg+xml;charset=utf-8,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h8v8H0zm8 8h8v8H8z' fill='%23e5e7eb'/%3E%3C/svg%3E\")",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 mb-1">
                          Código hexadecimal
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bgColor}
                            onChange={(e) =>
                              handleColorChange("bg", e.target.value)
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-mono shadow-sm"
                            maxLength={7}
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                          <div
                            className="color-preview-bg w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                            style={{ backgroundColor: bgColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={resetColors}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Restablecer colores predeterminados
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-6 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Combinaciones de colores prediseñadas
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setFgColor(preset.fg);
                          setBgColor(preset.bg);
                          gsap.to([".color-preview-fg", ".color-preview-bg"], {
                            backgroundColor: preset.fg,
                            duration: 0.3,
                            onComplete: () => {
                              gsap.to(".color-preview-bg", {
                                backgroundColor: preset.bg,
                                duration: 0.3,
                              });
                            },
                          });
                        }}
                        className="flex flex-col items-center group"
                      >
                        <div
                          className="w-full h-16 rounded-lg border border-gray-200 mb-2 overflow-hidden relative transition-all group-hover:shadow-md group-hover:border-gray-300"
                          style={{
                            backgroundColor: preset.bg,
                            backgroundImage:
                              preset.bg === "#ffffff"
                                ? "url(\"data:image/svg+xml;charset=utf-8,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h8v8H0zm8 8h8v8H8z' fill='%23e5e7eb'/%3E%3C/svg%3E\")"
                                : "none",
                          }}
                        >
                          <div
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-sm shadow-sm"
                            style={{ backgroundColor: preset.fg }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vista previa del QR */}
          <div className="w-full xl:w-1/2 p-8 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center">
            <div className="mb-8 w-full flex flex-col items-center">
              <div
                ref={qrPreviewRef}
                className="bg-white border-2 border-gray-200 rounded-2xl shadow-inner flex items-center justify-center transition-all overflow-hidden"
                style={{
                  width: `${
                    Math.min(size * PREVIEW_SCALE_FACTOR, MAX_PREVIEW_SIZE) + 32
                  }px`,
                  height: `${
                    Math.min(size * PREVIEW_SCALE_FACTOR, MAX_PREVIEW_SIZE) + 32
                  }px`,
                  maxWidth: "100%",
                }}
              >
                {text ? (
                  <div className="p-4">
                    <QRCodeCanvas
                      value={text}
                      size={Math.min(
                        size * PREVIEW_SCALE_FACTOR,
                        MAX_PREVIEW_SIZE
                      )}
                      bgColor={bgColor}
                      fgColor={fgColor}
                      level={level}
                    />
                  </div>
                ) : (
                  <div className="text-center p-2 text-gray-400">
                    <RiQrCodeLine
                      size={48}
                      className="mx-auto mb-3 opacity-50"
                    />
                    <p className="font-medium text-lg">Vista previa del QR</p>
                    <p className="text-sm mt-2 text-gray-500 max-w-xs">
                      Ingresa contenido arriba para generar una vista previa de
                      tu código QR
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 w-full max-w-md">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                </div>
              )}

              {text && (
                <div className="mt-6 w-full max-w-md text-center">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-700 break-words px-2">
                      {text.length > 120
                        ? `${text.substring(0, 120)}...`
                        : text}
                    </p>
                    <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                      <span>{text.length} caracteres</span>
                      <span>•</span>
                      <span>Nivel {level}</span>
                      <span>•</span>
                      <span className="font-semibold text-amber-600">
                        {size}px
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDownload}
              disabled={!text.trim() || isGenerating}
              className={`w-full max-w-md py-4 px-8 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 ${
                text.trim()
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              } ${isGenerating ? "opacity-80 cursor-wait" : ""}`}
            >
              {isGenerating ? (
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <FiDownload size={20} />
              )}
              {isGenerating
                ? "Generando..."
                : `Descargar QR (${imageFormat.toUpperCase()})`}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            <span className="font-semibold">Generador QR</span> • JLuu •{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

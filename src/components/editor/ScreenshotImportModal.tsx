import { useEffect, useMemo, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { sortImageFiles, type SortMode } from '../../services/screenshotImport';

type Props = {
  files: File[];
  mode: 'new' | 'insert';
  /** Only for mode "insert": the step number after which the new steps go. */
  afterStepNumber?: number;
  uiLang: 'en' | 'ru';
  busy: boolean;
  onCancel: () => void;
  onConfirm: (orderedFiles: File[]) => void;
};

const T = {
  en: {
    titleNew: 'Create a guide from screenshots',
    titleInsert: 'Add screenshots as steps',
    hintNew: 'Drag pictures to change the order. Remove the ones you do not need. Each picture becomes one step.',
    hintInsert: (n: number) =>
      n > 0
        ? `The new steps will be inserted after step ${n}. Drag pictures to change their order.`
        : 'The new steps will be added at the start. Drag pictures to change their order.',
    sortName: 'Order by file name',
    sortDate: 'Order by file date',
    count: (n: number) => `${n} pictures`,
    remove: 'Remove',
    create: 'Create guide',
    add: 'Add steps',
    cancel: 'Cancel',
    empty: 'No pictures left.',
    working: 'Working...',
  },
  ru: {
    titleNew: 'Создать гайд из скриншотов',
    titleInsert: 'Добавить скриншоты как шаги',
    hintNew: 'Перетаскивайте картинки, чтобы поменять порядок. Лишние уберите. Каждая картинка станет одним шагом.',
    hintInsert: (n: number) =>
      n > 0
        ? `Новые шаги встанут после шага ${n}. Перетаскивайте картинки, чтобы поменять порядок.`
        : 'Новые шаги встанут в начало. Перетаскивайте картинки, чтобы поменять порядок.',
    sortName: 'По имени файла',
    sortDate: 'По дате файла',
    count: (n: number) => `Картинок: ${n}`,
    remove: 'Убрать',
    create: 'Создать гайд',
    add: 'Добавить шаги',
    cancel: 'Отмена',
    empty: 'Картинок не осталось.',
    working: 'Подождите...',
  },
};

export function ScreenshotImportModal({
  files,
  mode,
  afterStepNumber = 0,
  uiLang,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const t = T[uiLang];
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [items, setItems] = useState<File[]>(() => sortImageFiles(files, 'name'));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const urls = useMemo(() => new Map(items.map((f) => [f, URL.createObjectURL(f)])), [items]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function applySort(mode: SortMode) {
    setSortMode(mode);
    setItems((prev) => sortImageFiles(prev, mode));
  }

  function drop(to: number) {
    if (dragFrom === null || dragFrom === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragFrom, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      data-testid="shot-import-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold">{mode === 'new' ? t.titleNew : t.titleInsert}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {mode === 'new' ? t.hintNew : t.hintInsert(afterStepNumber)}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label={t.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-sm font-semibold">
            {(['name', 'date'] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => applySort(m)}
                data-testid={`sort-${m}`}
                className={`px-3 py-1.5 transition ${
                  sortMode === m
                    ? 'bg-teal-700 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {m === 'name' ? t.sortName : t.sortDate}
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-300">{t.count(items.length)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-300 py-10">{t.empty}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((f, i) => (
                <div
                  key={`${f.name}-${f.lastModified}-${f.size}-${i}`}
                  draggable
                  data-testid="shot-tile"
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  className={`relative rounded-xl border bg-slate-50 dark:bg-slate-900/50 overflow-hidden cursor-grab active:cursor-grabbing ${
                    dragOver === i && dragFrom !== null && dragFrom !== i
                      ? 'border-teal-600 ring-2 ring-teal-500'
                      : 'border-slate-300 dark:border-slate-600'
                  } ${dragFrom === i ? 'opacity-40' : ''}`}
                >
                  <img
                    src={urls.get(f)}
                    alt={f.name}
                    draggable={false}
                    className="w-full aspect-video object-cover bg-slate-200 dark:bg-slate-700"
                  />
                  <span className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-teal-700 text-white text-sm font-bold flex items-center justify-center shadow">
                    {i + 1}
                  </span>
                  <button
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={busy}
                    title={t.remove}
                    aria-label={t.remove}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <GripVertical className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => onConfirm(items)}
            disabled={busy || items.length === 0}
            data-testid="shot-import-confirm"
            className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            {busy ? t.working : mode === 'new' ? t.create : t.add}
          </button>
        </div>
      </div>
    </div>
  );
}

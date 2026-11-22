import React, { useState } from 'react';
import { Layers, Trash2, Plus, Check } from 'lucide-react';
import type { GuideStep } from '../../types/guide';

interface SectionsEditorProps {
  steps: GuideStep[];
  uiLang: 'en' | 'ru';
  /** Called with the full new steps array. The parent saves it (autosave). */
  onChangeSteps: (steps: GuideStep[]) => void;
}

/**
 * Sections of a guide: a step with a section title starts a new section.
 * Rename, move, add and remove sections in one place; every change is saved at once.
 */
export const SectionsEditor: React.FC<SectionsEditorProps> = ({ steps, uiLang, onChangeSteps }) => {
  const isEn = uiLang === 'en';
  const [newStart, setNewStart] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [savedAt, setSavedAt] = useState<number>(0);

  const starts: number[] = [];
  steps.forEach((st, idx) => {
    if (st.chapterTitle || st.chapterTitleRu) starts.push(idx);
  });

  const commit = (next: GuideStep[]) => {
    onChangeSteps(next);
    setSavedAt(Date.now());
    setError('');
  };

  const setNames = (idx: number, patch: Partial<Pick<GuideStep, 'chapterTitle' | 'chapterTitleRu'>>) => {
    commit(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSection = (idx: number) => {
    commit(steps.map((s, i) => (i === idx ? { ...s, chapterTitle: undefined, chapterTitleRu: undefined } : s)));
  };

  const moveSection = (from: number, toStepNumber: number) => {
    const to = toStepNumber - 1;
    if (!Number.isInteger(to) || to < 0 || to >= steps.length) {
      setError(isEn ? `Step number must be from 1 to ${steps.length}.` : `Номер шага от 1 до ${steps.length}.`);
      return;
    }
    if (to === from) return;
    if (steps[to].chapterTitle || steps[to].chapterTitleRu) {
      setError(isEn ? `Step ${to + 1} already starts a section.` : `Шаг ${to + 1} уже начинает раздел.`);
      return;
    }
    const src = steps[from];
    commit(
      steps.map((s, i) => {
        if (i === from) return { ...s, chapterTitle: undefined, chapterTitleRu: undefined };
        if (i === to) return { ...s, chapterTitle: src.chapterTitle, chapterTitleRu: src.chapterTitleRu };
        return s;
      })
    );
  };

  const addSection = () => {
    const to = parseInt(newStart, 10) - 1;
    const name = newName.trim();
    if (!Number.isInteger(to) || to < 0 || to >= steps.length) {
      setError(isEn ? `Step number must be from 1 to ${steps.length}.` : `Номер шага от 1 до ${steps.length}.`);
      return;
    }
    if (!name) {
      setError(isEn ? 'Type a section name.' : 'Введите название раздела.');
      return;
    }
    if (steps[to].chapterTitle || steps[to].chapterTitleRu) {
      setError(isEn ? `Step ${to + 1} already starts a section.` : `Шаг ${to + 1} уже начинает раздел.`);
      return;
    }
    commit(steps.map((s, i) => (i === to ? { ...s, chapterTitle: name } : s)));
    setNewStart('');
    setNewName('');
  };

  const inputCls =
    'w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm"
      data-testid="sections-editor"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Layers className="w-4 h-4 text-teal-700 dark:text-teal-300" />
          {isEn ? 'Sections' : 'Разделы'}
        </h3>
        <span
          className={`text-sm flex items-center gap-1 text-teal-700 dark:text-teal-300 transition-opacity ${
            savedAt ? 'opacity-100' : 'opacity-0'
          }`}
          aria-live="polite"
        >
          <Check className="w-4 h-4" />
          {isEn ? 'Saved' : 'Сохранено'}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
        {isEn
          ? 'A section starts at the step you choose and lasts until the next section. Changes are saved at once, then download the guide again. Russian name is optional.'
          : 'Раздел начинается с выбранного шага и идёт до следующего раздела. Изменения сохраняются сразу, потом скачайте гайд заново. Русское название необязательно.'}
      </p>

      {starts.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          {isEn ? 'No sections yet. Add the first one below.' : 'Разделов пока нет. Добавьте первый ниже.'}
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
            <span className="col-span-2">{isEn ? 'From step' : 'С шага'}</span>
            <span className="col-span-4">{isEn ? 'Name' : 'Название'}</span>
            <span className="col-span-4">{isEn ? 'Name in Russian' : 'Название по-русски'}</span>
            <span className="col-span-2" />
          </div>
          {starts.map((idx, k) => {
            const end = k + 1 < starts.length ? starts[k + 1] : steps.length;
            const st = steps[idx];
            return (
              <div key={st.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center" data-testid="section-row">
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={steps.length}
                    defaultValue={idx + 1}
                    key={`${st.id}-${idx}`}
                    onBlur={(e) => moveSection(idx, parseInt(e.target.value, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    aria-label={isEn ? 'First step of the section' : 'Первый шаг раздела'}
                    className={inputCls}
                  />
                </div>
                <input
                  type="text"
                  value={st.chapterTitle || ''}
                  onChange={(e) => setNames(idx, { chapterTitle: e.target.value })}
                  aria-label={isEn ? 'Section name' : 'Название раздела'}
                  className={`md:col-span-4 ${inputCls}`}
                />
                <input
                  type="text"
                  value={st.chapterTitleRu || ''}
                  onChange={(e) => setNames(idx, { chapterTitleRu: e.target.value })}
                  aria-label={isEn ? 'Section name in Russian' : 'Название раздела по-русски'}
                  className={`md:col-span-4 ${inputCls}`}
                />
                <div className="md:col-span-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="whitespace-nowrap">
                    {idx + 1}-{end}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-600"
                    title={isEn ? 'Remove this section (its steps join the section above)' : 'Убрать раздел (его шаги перейдут в раздел выше)'}
                    aria-label={isEn ? 'Remove section' : 'Убрать раздел'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
        <label className="md:col-span-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {isEn ? 'New section from step' : 'Новый раздел с шага'}
          <input
            type="number"
            min={1}
            max={steps.length || 1}
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            data-testid="new-section-start"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="md:col-span-7 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {isEn ? 'Name' : 'Название'}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSection();
            }}
            data-testid="new-section-name"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <button
          type="button"
          onClick={addSection}
          data-testid="new-section-add"
          className="md:col-span-3 flex items-center justify-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          {isEn ? 'Add section' : 'Добавить раздел'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-2">
          {error}
        </p>
      )}
    </div>
  );
};

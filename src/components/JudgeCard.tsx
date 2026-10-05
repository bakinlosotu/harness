import React, { useState } from 'react';
import {
  Scale,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { JudgeEvaluation, ModelRef } from '../lib/storage';
import { getProviderBadgeClass, getProviderLetter } from './ModelPicker';

interface Props {
  judge: JudgeEvaluation;
  onRejudge?: (model?: ModelRef) => void;
  availableModels?: ModelRef[];
}

export const JudgeCard: React.FC<Props> = ({ judge, onRejudge, availableModels = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejudgeMenu, setShowRejudgeMenu] = useState(false);

  // If in-flight judging state
  if (judge.status === 'judging') {
    return (
      <div className="mt-3.5 p-3 rounded-xl border border-[var(--line)] bg-[var(--canvas)] flex items-center justify-between text-xs text-[var(--muted)] animate-pulse">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[var(--accent)] animate-spin" />
          <span className="font-medium text-[var(--ink)]">
            LLM Judge: Evaluating response accuracy with {judge.judgeModel.label}…
          </span>
        </div>
      </div>
    );
  }

  // If error during judging
  if (judge.status === 'error') {
    return (
      <div className="mt-3.5 p-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--canvas)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[var(--danger)]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Judge evaluation failed: {judge.error || 'Model error'}</span>
        </div>
        {onRejudge && (
          <button
            type="button"
            onClick={() => onRejudge()}
            className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    );
  }

  const score = judge.overallScore;
  const scoreColor =
    score >= 85
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : score >= 65
      ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';

  const riskBadge =
    judge.hallucinationRisk === 'low'
      ? { label: 'Low Risk', icon: ShieldCheck, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10' }
      : judge.hallucinationRisk === 'medium'
      ? { label: 'Med Risk', icon: AlertTriangle, color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10' }
      : { label: 'High Risk', icon: ShieldAlert, color: 'text-rose-700 dark:text-rose-400 bg-rose-500/10' };

  const RiskIcon = riskBadge.icon;

  return (
    <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs overflow-hidden transition-all">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[var(--canvas)] transition select-none"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--ink)]">
            <Scale className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>LLM Judge</span>
          </div>

          {/* Overall score badge */}
          <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ${scoreColor}`}>
            {score}/100
          </div>

          {/* Verdict pill */}
          <span className="text-[11px] font-medium text-[var(--muted)]">
            {judge.verdict}
          </span>

          {/* Hallucination risk */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBadge.color}`}>
            <RiskIcon className="w-3 h-3" />
            {riskBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Judge model identity */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <span>Evaluated by</span>
            <span
              className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${getProviderBadgeClass(
                judge.judgeModel.provider
              )}`}
            >
              {getProviderLetter(judge.judgeModel.provider)}
            </span>
            <span className="font-medium text-[var(--ink)]">{judge.judgeModel.label}</span>
          </div>

          <button
            type="button"
            className="p-1 text-[var(--muted)] hover:text-[var(--ink)]"
            title={isExpanded ? 'Collapse' : 'Expand evaluation breakdown'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detailed scorecard */}
      {isExpanded && (
        <div className="px-4 py-3.5 border-t border-[var(--line)] bg-[var(--canvas)]/50 space-y-3.5 text-xs">
          {/* Judge Summary */}
          {judge.summary && (
            <p className="text-[var(--ink)] leading-relaxed text-[13px] bg-[var(--surface)] p-3 rounded-lg border border-[var(--line)]">
              {judge.summary}
            </p>
          )}

          {/* Sub-metric Score Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
              <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1">
                <span>Accuracy</span>
                <span className="font-bold text-[var(--ink)]">{judge.accuracyScore}/10</span>
              </div>
              <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${(judge.accuracyScore / 10) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
              <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1">
                <span>Completeness</span>
                <span className="font-bold text-[var(--ink)]">{judge.completenessScore}/10</span>
              </div>
              <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${(judge.completenessScore / 10) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
              <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1">
                <span>Clarity</span>
                <span className="font-bold text-[var(--ink)]">{judge.clarityScore}/10</span>
              </div>
              <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full"
                  style={{ width: `${(judge.clarityScore / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {judge.strengths && judge.strengths.length > 0 && (
              <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                </div>
                <ul className="space-y-1 text-[var(--ink)] text-[12px]">
                  {judge.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {judge.weaknesses && judge.weaknesses.length > 0 && (
              <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <div className="font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Caveats & Omissions
                </div>
                <ul className="space-y-1 text-[var(--ink)] text-[12px]">
                  {judge.weaknesses.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Suggested Corrections */}
          {judge.suggestedCorrections && judge.suggestedCorrections.toLowerCase() !== 'null' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[var(--ink)]">
              <div className="font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Suggested Correction / Missing Context
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--ink)]">
                {judge.suggestedCorrections}
              </p>
            </div>
          )}

          {/* Re-judge action bar */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs text-[var(--muted)]">
            <div className="flex items-center gap-1">
              <span>Evaluated at {new Date(judge.evaluatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>

            {onRejudge && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRejudgeMenu(!showRejudgeMenu)}
                  className="px-2.5 py-1 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <RotateCw className="w-3 h-3 text-[var(--accent)]" />
                  <span>Re-judge with…</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showRejudgeMenu && (
                  <div className="absolute right-0 bottom-full mb-1 w-52 bg-[var(--surface)] border border-[var(--line)] rounded-lg shadow-xl py-1 z-30 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejudgeMenu(false);
                        onRejudge();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-2 cursor-pointer border-b border-[var(--line)]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Auto-pick Judge</span>
                    </button>
                    {availableModels.map((m) => (
                      <button
                        key={`${m.provider}:${m.id}`}
                        type="button"
                        onClick={() => {
                          setShowRejudgeMenu(false);
                          onRejudge(m);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${getProviderBadgeClass(
                            m.provider
                          )}`}
                        >
                          {getProviderLetter(m.provider)}
                        </span>
                        <span className="truncate">{m.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

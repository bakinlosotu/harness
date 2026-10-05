import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Users,
  Award,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  MessageSquare,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CouncilSession } from '../lib/storage';
import { getProviderBadgeClass, getProviderLetter } from './ModelPicker';

interface Props {
  session: CouncilSession;
}

export const CouncilView: React.FC<Props> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'verdict' | 'round1' | 'round2'>(
    session.consensus ? 'verdict' : session.currentRound === 2 ? 'round2' : 'round1'
  );
  const [copied, setCopied] = useState(false);

  const handleCopyTranscript = () => {
    let transcript = `# 🏛️ AI COUNCIL DELIBERATION\nTopic: ${session.topic}\n\n`;

    transcript += `## COUNCIL MEMBERS\n`;
    session.members.forEach((m) => {
      transcript += `- ${m.model.label} (${m.roleTitle})\n`;
    });
    transcript += `\n`;

    transcript += `## ROUND 1: OPENING POSITIONS\n\n`;
    session.round1.forEach((s) => {
      transcript += `### ${s.member.roleTitle} (${s.member.model.label}):\n${s.text}\n\n`;
    });

    if (session.round2.length > 0) {
      transcript += `## ROUND 2: CROSS-EXAMINATION & CRITIQUE\n\n`;
      session.round2.forEach((s) => {
        transcript += `### ${s.member.roleTitle} (${s.member.model.label}):\n${s.text}\n\n`;
      });
    }

    if (session.consensus) {
      transcript += `## COUNCIL CONSENSUS & VERDICT\n\n${session.consensus.synthesisText}\n`;
    }

    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDeliberating = session.status === 'debating' || session.status === 'convening';
  const isSynthesizing = session.status === 'synthesizing';

  return (
    <div className="my-6 max-w-[760px] w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-md overflow-hidden transition-all">
      {/* Council Chamber Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--line)] bg-gradient-to-r from-[var(--canvas)] to-[var(--surface)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--accent)] text-white shadow-xs">
                <Users className="w-4 h-4" />
              </span>
              <h3 className="font-semibold text-base text-[var(--ink)] tracking-tight">
                AI Council Chamber
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-[var(--accent-soft)] text-[var(--accent)]">
                {session.status === 'done'
                  ? 'Consensus Reached'
                  : isSynthesizing
                  ? 'Synthesizing Verdict…'
                  : 'Debate in Progress'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Multi-model dialectic debate and cross-examination across leading AI labs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyTranscript}
            className="px-2.5 py-1 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--canvas)] flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            title="Copy full council debate transcript"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy Debate'}</span>
          </button>
        </div>

        {/* Participating Council Members */}
        <div className="mt-4 flex flex-wrap gap-2">
          {session.members.map((m, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs shadow-2xs"
            >
              <span
                className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${getProviderBadgeClass(
                  m.model.provider
                )}`}
              >
                {getProviderLetter(m.model.provider)}
              </span>
              <div>
                <span className="font-semibold text-[var(--ink)] block leading-tight">
                  {m.model.label}
                </span>
                <span className="text-[10px] text-[var(--muted)] block leading-none">
                  {m.roleTitle}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deliberation Status Stepper */}
      <div className="px-4 py-2 border-b border-[var(--line)] bg-[var(--canvas)]/70 flex items-center justify-between text-xs overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('round1')}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'round1'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--line)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>1. Positions</span>
            {isDeliberating && session.currentRound === 1 && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
            )}
          </button>

          <ChevronRight className="w-3 h-3 text-[var(--muted)] shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('round2')}
            disabled={session.round2.length === 0}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
              session.round2.length === 0
                ? 'opacity-40 cursor-not-allowed text-[var(--muted)]'
                : activeTab === 'round2'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--line)] cursor-pointer'
                : 'text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Cross-Exam</span>
            {isDeliberating && session.currentRound === 2 && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
            )}
          </button>

          <ChevronRight className="w-3 h-3 text-[var(--muted)] shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('verdict')}
            disabled={!session.consensus && !isSynthesizing}
            className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition ${
              !session.consensus && !isSynthesizing
                ? 'opacity-40 cursor-not-allowed text-[var(--muted)]'
                : activeTab === 'verdict'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs border border-[var(--line)] cursor-pointer'
                : 'text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>3. Verdict</span>
            {isSynthesizing && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Live indicator */}
        {(isDeliberating || isSynthesizing) && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="hidden sm:inline">Council deliberating…</span>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="p-4 sm:p-5">
        {/* TAB 1: Round 1 Positions */}
        {activeTab === 'round1' && (
          <div className="space-y-4">
            <div className="text-xs text-[var(--muted)] mb-2">
              Each council model independently formulated their initial thesis and solution for:
              <strong className="text-[var(--ink)] block mt-0.5 font-medium">"{session.topic}"</strong>
            </div>

            {session.round1.map((speech, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--line)] bg-[var(--canvas)]/40 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--line)]/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${getProviderBadgeClass(
                        speech.member.model.provider
                      )}`}
                    >
                      {getProviderLetter(speech.member.model.provider)}
                    </span>
                    <span className="font-semibold text-xs text-[var(--ink)]">
                      {speech.member.model.label}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      — {speech.member.roleTitle}
                    </span>
                  </div>

                  {speech.status === 'streaming' && (
                    <span className="text-[10px] text-[var(--accent)] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                      Speaking…
                    </span>
                  )}
                </div>

                <div className="assistant-prose text-xs leading-relaxed text-[var(--ink)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {speech.text || 'Formulating opening statement…'}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: Round 2 Cross-Examination */}
        {activeTab === 'round2' && (
          <div className="space-y-4">
            <div className="text-xs text-[var(--muted)] mb-2">
              Council members reviewed each other's opening positions, challenging weak points and refining consensus:
            </div>

            {session.round2.map((speech, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--line)] bg-[var(--canvas)]/40 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--line)]/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${getProviderBadgeClass(
                        speech.member.model.provider
                      )}`}
                    >
                      {getProviderLetter(speech.member.model.provider)}
                    </span>
                    <span className="font-semibold text-xs text-[var(--ink)]">
                      {speech.member.model.label}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      — Rebuttal & Critique
                    </span>
                  </div>

                  {speech.status === 'streaming' && (
                    <span className="text-[10px] text-[var(--accent)] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                      Debating…
                    </span>
                  )}
                </div>

                <div className="assistant-prose text-xs leading-relaxed text-[var(--ink)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {speech.text || 'Analyzing fellow council members arguments…'}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Council Verdict & Consensus */}
        {activeTab === 'verdict' && (
          <div className="space-y-4">
            {isSynthesizing && !session.consensus && (
              <div className="p-8 text-center space-y-3">
                <Sparkles className="w-6 h-6 text-[var(--accent)] animate-spin mx-auto" />
                <div className="font-semibold text-sm text-[var(--ink)]">
                  Council Chair ({session.chairModel.label}) is synthesizing the verdict…
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Distilling unanimous agreements, resolving debated trade-offs, and drafting the final outcome.
                </p>
              </div>
            )}

            {session.consensus && (
              <div className="space-y-4">
                {/* Synthesis Output */}
                <div className="assistant-prose text-sm text-[var(--ink)] bg-[var(--canvas)]/40 p-4 sm:p-5 rounded-xl border border-[var(--accent)]/30">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {session.consensus.synthesisText}
                  </ReactMarkdown>
                </div>

                {/* Consensus Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {session.consensus.agreedPoints && session.consensus.agreedPoints.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="font-semibold text-xs text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Unanimous Agreements
                      </div>
                      <ul className="space-y-1.5 text-xs text-[var(--ink)]">
                        {session.consensus.agreedPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.consensus.debatedTradeoffs && session.consensus.debatedTradeoffs.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="font-semibold text-xs text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Key Trade-offs & Nuances
                      </div>
                      <ul className="space-y-1.5 text-xs text-[var(--ink)]">
                        {session.consensus.debatedTradeoffs.map((pt, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

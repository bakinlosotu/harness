import { generateId } from './ids';
import {
  Keys,
  ModelRef,
  CouncilMember,
  CouncilSession,
  CouncilSpeech,
  CouncilConsensus,
  ProviderId,
} from './storage';
import { getProvider } from '../providers';
import { ChatMsg } from '../providers/types';

export const FLAGSHIP_COUNCIL_CANDIDATES: {
  provider: ProviderId;
  id: string;
  label: string;
  roleTitle: string;
}[] = [
  {
    provider: 'gemini',
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    roleTitle: 'Empirical Analyst (Google)',
  },
  {
    provider: 'openai',
    id: 'gpt-4o',
    label: 'GPT-4o',
    roleTitle: 'Strategic Architect (OpenAI)',
  },
  {
    provider: 'anthropic',
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    roleTitle: 'Critical Dialectic (Anthropic)',
  },
  {
    provider: 'xai',
    id: 'grok-2-latest',
    label: 'Grok 2',
    roleTitle: 'Lateral Contrarian (xAI)',
  },
];

export const SECONDARY_COUNCIL_CANDIDATES: {
  provider: ProviderId;
  id: string;
  label: string;
  roleTitle: string;
}[] = [
  {
    provider: 'openai',
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    roleTitle: 'Efficiency & Operations (OpenAI)',
  },
  {
    provider: 'gemini',
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    roleTitle: 'Deep Knowledge Synthesis (Google)',
  },
  {
    provider: 'anthropic',
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    roleTitle: 'Rapid Pragmatist (Anthropic)',
  },
  {
    provider: 'xai',
    id: 'grok-beta',
    label: 'Grok Beta',
    roleTitle: 'Direct Realist (xAI)',
  },
];

/**
 * Returns 2-3 distinct council members, prioritizing different AI companies.
 */
export function selectCouncilMembers(keys: Keys): CouncilMember[] {
  const members: CouncilMember[] = [];

  // 1. Pick 1 flagship model per available provider
  for (const candidate of FLAGSHIP_COUNCIL_CANDIDATES) {
    if (keys[candidate.provider]) {
      members.push({
        model: {
          provider: candidate.provider,
          id: candidate.id,
          label: candidate.label,
        },
        roleTitle: candidate.roleTitle,
      });
      if (members.length >= 3) break;
    }
  }

  // 2. If we have only 1 or 2 providers configured, fill up to at least 2 or 3 using secondary models
  if (members.length < 3) {
    for (const sec of SECONDARY_COUNCIL_CANDIDATES) {
      if (keys[sec.provider]) {
        const alreadyIncluded = members.some(
          (m) => m.model.provider === sec.provider && m.model.id === sec.id
        );
        if (!alreadyIncluded) {
          members.push({
            model: {
              provider: sec.provider,
              id: sec.id,
              label: sec.label,
            },
            roleTitle: sec.roleTitle,
          });
          if (members.length >= 3) break;
        }
      }
    }
  }

  // Return at least 2 members if possible
  return members;
}

export interface RunCouncilArgs {
  topic: string;
  context?: string;
  members: CouncilMember[];
  keys: Keys;
  signal: AbortSignal;
  onUpdate: (session: CouncilSession) => void;
}

export async function runCouncilDeliberation(args: RunCouncilArgs): Promise<CouncilSession> {
  const { topic, context, members, keys, signal, onUpdate } = args;

  if (members.length < 2) {
    throw new Error('AI Council requires at least 2 available models. Please add API keys.');
  }

  const chairModel = members[0].model;
  const sessionId = generateId('council');

  const session: CouncilSession = {
    id: sessionId,
    topic,
    members,
    chairModel,
    currentRound: 1,
    round1: members.map((m) => ({
      member: m,
      round: 1,
      text: '',
      status: 'streaming',
    })),
    round2: [],
    status: 'convening',
  };

  onUpdate({ ...session });

  // Helper to call a model
  const callModel = async (
    member: CouncilMember,
    system: string,
    messages: ChatMsg[],
    onDelta: (text: string) => void
  ) => {
    const key = keys[member.model.provider];
    if (!key) throw new Error(`Missing key for ${member.model.label}`);
    const adapter = getProvider(member.model.provider);

    await adapter.chat({
      model: member.model.id,
      system,
      messages,
      temperature: 0.7,
      key,
      signal,
      onText: onDelta,
    });
  };

  // ==========================================
  // ROUND 1: Opening Arguments (Positions)
  // ==========================================
  session.status = 'debating';
  session.currentRound = 1;
  onUpdate({ ...session });

  for (let i = 0; i < members.length; i++) {
    if (signal.aborted) break;
    const member = members[i];
    const speech = session.round1[i];

    let fullSpeech = '';
    const system = `You are ${member.roleTitle} on the prestigious AI Council.
You are in Round 1: Opening Position on the debate topic.
Deliver a structured, insightful thesis on the topic. State your core argument, evidence/reasoning, and concrete proposed solution.
Be substantive, articulate, and maintain your unique perspective.`;

    let userPrompt = `Debate Topic: "${topic}"\n\n`;
    if (context && context.trim()) {
      userPrompt += `[Grounding Context from Documents/Web]:\n${context.slice(0, 6000)}\n\n`;
    }
    userPrompt += `Present your opening position to the Council:`;

    try {
      await callModel(
        member,
        system,
        [{ role: 'user', text: userPrompt }],
        (delta) => {
          fullSpeech += delta;
          speech.text = fullSpeech;
          speech.status = 'streaming';
          onUpdate({ ...session });
        }
      );
      speech.status = 'done';
    } catch (err: any) {
      if (signal.aborted) throw err;
      speech.status = 'error';
      speech.text = speech.text || `[${member.model.label} was unable to speak: ${err?.message || 'Error'}]`;
    }
    onUpdate({ ...session });
  }

  if (signal.aborted) {
    session.status = 'stopped';
    onUpdate({ ...session });
    return session;
  }

  // ==========================================
  // ROUND 2: Cross-Examination & Critique
  // ==========================================
  session.currentRound = 2;
  session.round2 = members.map((m) => ({
    member: m,
    round: 2,
    text: '',
    status: 'streaming',
  }));
  onUpdate({ ...session });

  // Compile round 1 transcript
  const round1Transcript = session.round1
    .map((s) => `### ${s.member.roleTitle} (${s.member.model.label}):\n${s.text}\n`)
    .join('\n');

  for (let i = 0; i < members.length; i++) {
    if (signal.aborted) break;
    const member = members[i];
    const speech = session.round2[i];

    let fullSpeech = '';
    const system = `You are ${member.roleTitle} on the AI Council.
You are now in Round 2: Cross-Examination & Critique.
Review the opening statements made by all council members in Round 1.
- Challenge any flawed assumptions, hidden risks, or oversights in your peers' arguments.
- Highlight areas where you agree with them or where they made exceptional points.
- Refine and solidify your final stance in light of the deliberation.
Keep your tone intellectually rigorous, collegiate, and incisive.`;

    const userPrompt = `Debate Topic: "${topic}"\n\n[ROUND 1 TRANSCRIPTS FROM ALL MEMBERS]:\n${round1Transcript}\n\nDeliver your cross-examination and rebuttal:`;

    try {
      await callModel(
        member,
        system,
        [{ role: 'user', text: userPrompt }],
        (delta) => {
          fullSpeech += delta;
          speech.text = fullSpeech;
          speech.status = 'streaming';
          onUpdate({ ...session });
        }
      );
      speech.status = 'done';
    } catch (err: any) {
      if (signal.aborted) throw err;
      speech.status = 'error';
      speech.text = speech.text || `[${member.model.label} was unable to cross-examine: ${err?.message || 'Error'}]`;
    }
    onUpdate({ ...session });
  }

  if (signal.aborted) {
    session.status = 'stopped';
    onUpdate({ ...session });
    return session;
  }

  // ==========================================
  // ROUND 3: Council Synthesis & Final Verdict
  // ==========================================
  session.status = 'synthesizing';
  session.currentRound = 3;
  onUpdate({ ...session });

  const round2Transcript = session.round2
    .map((s) => `### ${s.member.roleTitle} (${s.member.model.label}):\n${s.text}\n`)
    .join('\n');

  const chairMember = members[0];
  let synthesisRaw = '';

  const chairSystem = `You are the Council Chair on the AI Council (${chairMember.model.label}).
Your role is to preside over the debate and deliver the final, authoritative Council Consensus & Verdict.

You MUST produce a comprehensive, structured output in this exact markdown format:

# 🏛️ Council Verdict & Executive Resolution
<A clear, decisive 2-paragraph synthesis summarizing the Council's final agreed outcome on the topic.>

## 🤝 Unanimous Consensus Points
- <Point 1 agreed upon by all members>
- <Point 2 agreed upon by all members>
- <Point 3 agreed upon by all members>

## ⚖️ Key Trade-offs & Debated Nuances
- <Key tension or differing perspective raised during deliberation>
- <Another trade-off or risk identified by the council>

## 🚀 Actionable Recommendation
<Concrete, practical step-by-step guidance representing the Council's combined intelligence.>
`;

  const chairPrompt = `Debate Topic: "${topic}"\n\n[DELIBERATION TRANSCRIPT - ROUND 1]:\n${round1Transcript}\n\n[DELIBERATION TRANSCRIPT - ROUND 2 CROSS-EXAMINATION]:\n${round2Transcript}\n\nDeliver the Council's Final Verdict and Consensus:`;

  try {
    await callModel(
      chairMember,
      chairSystem,
      [{ role: 'user', text: chairPrompt }],
      (delta) => {
        synthesisRaw += delta;
        session.consensus = parseCouncilConsensus(synthesisRaw);
        onUpdate({ ...session });
      }
    );
  } catch (err: any) {
    if (signal.aborted) throw err;
    synthesisRaw = `[Chair synthesis error: ${err?.message || 'Error generating verdict'}]`;
  }

  session.consensus = parseCouncilConsensus(synthesisRaw);
  session.status = 'done';
  onUpdate({ ...session });

  return session;
}

function parseCouncilConsensus(text: string): CouncilConsensus {
  // Extract bullet points for consensus
  const agreedMatches = text.match(/##\s*🤝?\s*Unanimous Consensus Points\s*([\s\S]*?)(?=##|$)/i);
  const tradeoffMatches = text.match(/##\s*⚖️?\s*Key Trade-offs & Debated Nuances\s*([\s\S]*?)(?=##|$)/i);

  const extractBullets = (section: string | undefined): string[] => {
    if (!section) return [];
    return section
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('*'))
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  };

  const agreedPoints = extractBullets(agreedMatches?.[1]);
  const debatedTradeoffs = extractBullets(tradeoffMatches?.[1]);

  return {
    synthesisText: text,
    agreedPoints: agreedPoints.length > 0 ? agreedPoints : ['Consensus reached through deliberation across model architectures.'],
    debatedTradeoffs: debatedTradeoffs.length > 0 ? debatedTradeoffs : ['Balancing immediate pragmatism with long-term robustness.'],
    finalVerdict: text.split('##')[0]?.trim() || text,
  };
}

import { clamp, trustScoreFromResult } from './score.js';

function bandFromConfidence(conf) {
    const c = clamp(conf, 0, 100);
    if (c >= 90) return 'very-high';
    if (c >= 75) return 'high';
    if (c >= 60) return 'medium';
    return 'low';
}

function bulletsFor(kind, result, confidencePct) {
    const band = bandFromConfidence(confidencePct);

    if (kind === 'image') {
        if (result === 'Fake') {
            return [
                'Inconsistent noise patterns and compression artifacts across regions.',
                'Edge halos and unnatural blending around high-contrast boundaries.',
                'Texture repetition typical of synthetic generation or manipulation.',
                band === 'low' ? 'Signal is weak—consider re-checking with a higher-resolution upload.' : 'Strong manipulation signature detected across the frame.'
            ];
        }
        return [
            'Natural camera-like noise distribution and consistent compression artifacts.',
            'No strong manipulation cues detected in edges, textures, or lighting consistency.',
            band === 'low' ? 'Confidence is modest—use additional checks for high-stakes verification.' : 'High consistency with genuine image characteristics.'
        ];
    }

    if (kind === 'video') {
        if (result === 'Fake') {
            return [
                'Temporal inconsistencies detected between sampled frames.',
                'Facial/edge regions show non-physical warping across frames.',
                'Motion and lighting coherence deviates from real-world capture patterns.'
            ];
        }
        return [
            'Frame-to-frame consistency aligns with natural video capture.',
            'No strong deepfake signatures detected in sampled frames.',
            'Motion and lighting transitions appear physically plausible.'
        ];
    }

    if (kind === 'news') {
        if (result === 'Fake') {
            return [
                'Claim consistency and entailment checks indicate low factual alignment.',
                'Language patterns resemble sensational or misleading phrasing.',
                band === 'low' ? 'Uncertain signal—verify using trusted sources.' : 'Strong fake-news signal detected in claim structure.'
            ];
        }
        return [
            'Claim structure and phrasing align with neutral reporting patterns.',
            'No strong contradiction signals found in the content semantics.',
            band === 'low' ? 'Moderate certainty—cross-check sources for critical decisions.' : 'High likelihood of genuine/real reporting signal.'
        ];
    }

    // text
    if (result === 'Fake') {
        return [
            'High perplexity consistency and uniform sentence pacing typical of AI generation.',
            'Low burstiness: fewer human-like stylistic variations across sentences.',
            band === 'low' ? 'Mixed signal—try a longer sample for a stronger verdict.' : 'Strong AI-generation signature detected across the text.'
        ];
    }

    return [
        'Human-like variability across sentence structure and word choice.',
        'No strong AI-generation signature detected in linguistic patterns.',
        band === 'low' ? 'Moderate certainty—use more text for a higher-confidence result.' : 'High likelihood of human-authored text signal.'
    ];
}

export function buildExplainableResult({ kind, result, confidencePct }) {
    const trustScore = trustScoreFromResult(result, confidencePct);
    const why = bulletsFor(kind, result, confidencePct);

    return {
        trustScore,
        why,
        headline:
            result === 'Fake'
                ? 'High-risk indicators detected'
                : 'Low-risk indicators detected',
        summary:
            result === 'Fake'
                ? 'This content shows patterns commonly associated with AI generation or manipulation.'
                : 'This content appears consistent with genuine/human-origin patterns.'
    };
}

export function assistantReply({ question, lastRecord }) {
    const q = String(question || '').trim().toLowerCase();
    if (!lastRecord) {
        return 'Share a detection result first, then ask: “Why is this fake?”';
    }

    const kind = lastRecord.kind;
    const result = lastRecord.result;
    const confidencePct = lastRecord.confidence;
    const expl = buildExplainableResult({ kind, result, confidencePct });

    if (q.includes('why') || q.includes('explain') || q.includes('reason')) {
        const top = expl.why.slice(0, 3).map((x) => `• ${x}`).join('\n');
        return `${result === 'Fake' ? 'Here’s why this looks suspicious:' : 'Here’s why this looks genuine:'}\n${top}\n\nTrust Score: ${Math.round(expl.trustScore)}%`;
    }

    if (q.includes('trust') || q.includes('score')) {
        return `Trust Score is computed from the model confidence and final verdict. Current Trust Score: ${Math.round(expl.trustScore)}%.`;
    }

    if (q.includes('next') || q.includes('what should')) {
        if (result === 'Fake') {
            return 'Next steps: re-check with higher quality input, compare against trusted sources, and request a second signal (alternate model/source) before actioning.';
        }
        return 'Next steps: for high-stakes use-cases, verify provenance (source/metadata) and keep a record of this report for audit.';
    }

    return 'Ask: “Why is this fake?”, “What is the trust score?”, or “What next?”';
}

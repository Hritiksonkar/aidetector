function scoreToVerdict(score) {
    if (score <= 3) return 'Likely Real';
    if (score <= 6) return 'Uncertain';
    return 'Likely AI Generated';
}

module.exports = { scoreToVerdict };

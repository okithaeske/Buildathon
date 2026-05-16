const { isMockAi } = require('./config');

function isMock() {
  return isMockAi();
}

const fixtures = {
  conceptSummary: {
    industry: 'EdTech',
    audience: 'Rural students in Sri Lanka',
    productType: 'AI tutoring platform',
    geography: 'Sri Lanka',
    summary:
      'An AI-powered tutor for rural students in Sri Lanka that delivers personalized lessons via mobile in Sinhala and Tamil.',
  },
  scan: {
    opportunityRating: 'amber',
    competitors: [
      { name: 'LearnX Lanka', description: 'Local edtech with offline content', funding: 'Seed' },
      { name: 'Khan Academy', description: 'Global free learning platform', funding: 'Non-profit' },
    ],
    marketSize: '~2M rural students in Sri Lanka seeking supplemental education',
    uspGaps: ['Localized curriculum alignment', 'Offline-first AI tutoring', 'Sinhala/Tamil voice interface'],
    citations: ['https://example.com/edtech-sri-lanka'],
  },
  audit: {
    risks: [
      {
        category: 'legal',
        description: 'Education content may require Ministry of Education alignment for school partnerships.',
        severity: 'medium',
        mitigation: 'Partner with accredited institutions and seek advisory review.',
      },
      {
        category: 'operational',
        description: 'Reliable internet connectivity varies in rural areas.',
        severity: 'high',
        mitigation: 'Build offline-capable lesson caching and SMS fallback notifications.',
      },
    ],
    citations: ['https://example.com/sri-lanka-education-regulations'],
  },
  refineQuestions: [
    'Who is your ideal customer, and what problem are they paying to solve today?',
    'How will the business make money — subscription, one-time, or commission?',
    'What stops a well-funded competitor from copying this in 6 months?',
    'How will your first 100 customers find you?',
    'Why are you the right person to build this?',
  ],
  ideaProfile: {
    customer: 'Rural secondary students and parents in Sri Lanka seeking affordable tutoring',
    revenue: 'Freemium subscription at $3/month with school bulk licensing',
    moat: 'Localized curriculum, offline AI, and partnerships with rural schools',
    gtm: 'School pilot programs and community ambassador networks',
    founderFit: 'Deep local education experience and existing school relationships',
  },
  validate: {
    overall: 74,
    breakdown: {
      marketOpportunity: 78,
      competitiveRisk: 42,
      legalComplexity: 30,
      differentiation: 68,
    },
    summary: 'Strong potential with clear differentiation in localized offline AI tutoring for rural Sri Lanka.',
  },
  pitchDeck: [
    { slide: 1, title: 'Hook', content: 'Rural students in Sri Lanka are left behind by one-size-fits-all edtech.' },
    { slide: 2, title: 'Problem', content: '2M students lack affordable, localized tutoring that works offline.' },
    { slide: 3, title: 'Solution', content: 'AI tutor delivering personalized lessons in Sinhala and Tamil, offline-first.' },
    { slide: 4, title: 'Market Size', content: 'TAM $500M SEA rural edtech; SAM $80M Sri Lanka; SOM $8M year 3.' },
    { slide: 5, title: 'Business Model', content: 'Freemium B2C + B2B school licenses at $2/student/month.' },
    { slide: 6, title: 'Traction', content: '3 school pilots, 400 waitlist signups, 92% lesson completion rate.' },
    { slide: 7, title: 'Competition', content: 'Global players lack localization; local players lack AI depth.' },
    { slide: 8, title: 'Go-to-Market', content: 'School partnerships → parent referrals → community ambassadors.' },
    { slide: 9, title: 'Team', content: 'Founders with 10+ years in Sri Lankan education and AI engineering.' },
    { slide: 10, title: 'The Ask', content: 'Raising $500K seed for product, pilots, and team expansion.' },
  ],
  investorQA: [
    {
      question: 'Why will students switch from free YouTube tutorials?',
      framework: 'Lead with offline + curriculum alignment pain → cite pilot retention data → explain switching cost via progress tracking.',
    },
  ],
  marketingPack: {
    taglines: ['Learn anywhere. Grow everywhere.', 'AI tutoring built for rural Sri Lanka.', 'Your village classroom, powered by AI.'],
    heroCopy: 'Personalized AI tutoring in your language — even without reliable internet.',
    socialPosts: {
      instagram: 'Every student deserves a tutor who speaks their language. 🎓 #EdTech #SriLanka',
      linkedin: 'We are building offline-first AI tutoring for 2M rural students in Sri Lanka.',
      twitter: 'Rural edtech is broken. We are fixing it with localized AI. 🚀',
    },
    coldEmail: 'Subject: Pilot AI tutoring at your school\n\nHi [Name],\n\nWe help rural schools deliver personalized AI lessons in Sinhala/Tamil...',
    pressRelease: 'FOR IMMEDIATE RELEASE: LaunchPad Tutor brings AI-powered education to rural Sri Lanka...',
    seoKeywords: ['AI tutor Sri Lanka', 'rural edtech', 'offline learning app', 'Sinhala education'],
  },
  campaign: {
    adScript: 'Meet the brand that turns everyday style into confidence. Premium fabrics. Honest prices. Shop the new collection today.',
    taglines: ['Style that speaks.', 'Wear your story.', 'Made for real life.'],
    captions: {
      instagram: 'New drop alert 🔥 Link in bio. #Fashion #OOTD',
      tiktok: 'POV: you found the perfect fit ✨ #fashiontok',
      twitter: 'The collection everyone is talking about. Shop now →',
    },
    emailCopy: 'Subject: The new collection is here\n\nDiscover pieces designed for comfort and confidence...',
    heroCopy: 'Elevated essentials for every day.',
    videoUrl: null,
    bannerUrl: 'https://placehold.co/1200x630/png?text=Campaign+Banner',
    audioUrl: 'https://example.com/audio/campaign-demo.mp3',
  },
};

module.exports = { isMock, fixtures };

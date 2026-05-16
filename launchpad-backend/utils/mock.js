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
    {
      slide: 1,
      layout: 'title',
      title: 'Learn anywhere. Grow everywhere.',
      subtitle: 'AI tutoring built for rural Sri Lanka.',
      bullets: [],
      content: 'Rural students in Sri Lanka are left behind by one-size-fits-all edtech.',
      speakerNotes:
        'Open with the human story — two million rural students in Sri Lanka still have no real tutor. We are changing that.',
    },
    {
      slide: 2,
      layout: 'bullets',
      title: 'The Problem',
      subtitle: 'Why rural students are falling behind',
      bullets: [
        '2M rural students lack affordable, localized tutoring',
        'Existing apps are English-first and need fast internet',
        'Teachers are overstretched and follow a generic curriculum',
      ],
      content: '2M students lack affordable, localized tutoring that works offline.',
      speakerNotes:
        'Walk through the three pains. The gap is widening every year because connectivity and language remain unsolved.',
    },
    {
      slide: 3,
      layout: 'bullets',
      title: 'Our Solution',
      subtitle: 'Personalized AI tutoring in Sinhala & Tamil',
      bullets: [
        'AI tutor that adapts to each student’s pace and curriculum',
        'Sinhala and Tamil voice interface, offline-first lessons',
        'Parents and teachers get progress dashboards via SMS',
      ],
      content: 'AI tutor delivering personalized lessons in Sinhala and Tamil, offline-first.',
      speakerNotes:
        'Show how the AI tutor closes each problem — language, connectivity, and curriculum fit — in a single product.',
    },
    {
      slide: 4,
      layout: 'chart',
      title: 'Market Size',
      subtitle: 'A $500M opportunity in South Asia rural edtech',
      bullets: ['TAM: $500M', 'SAM: $80M', 'SOM: $8M by year 3'],
      content: 'TAM $500M SEA rural edtech; SAM $80M Sri Lanka; SOM $8M year 3.',
      speakerNotes:
        'Anchor on TAM/SAM/SOM. Sri Lanka is the wedge; the same playbook works across South Asian rural markets.',
    },
    {
      slide: 5,
      layout: 'bullets',
      title: 'Business Model',
      subtitle: 'Freemium consumer + B2B school licenses',
      bullets: [
        'Freemium: $3/month family plan, 7-day trial',
        'Schools: $2/student/month with bulk pricing',
        'NGO partnerships unlock sponsored seats',
      ],
      content: 'Freemium B2C + B2B school licenses at $2/student/month.',
      speakerNotes:
        'Two complementary revenue lines — direct families and school licenses — with NGOs as a force multiplier.',
    },
    {
      slide: 6,
      layout: 'metric',
      title: 'Traction',
      subtitle: '400 waitlist signups • 92% lesson completion',
      bullets: ['3 active school pilots', '400 waitlist signups', '92% lesson completion in pilots'],
      content: '3 school pilots, 400 waitlist signups, 92% lesson completion rate.',
      speakerNotes:
        'Lead with the headline: completion rate. Then briefly mention waitlist and pilots as proof of demand and engagement.',
    },
    {
      slide: 7,
      layout: 'competition',
      title: 'Competition',
      subtitle: 'Global players lack localization, local players lack AI',
      bullets: [
        'LearnX Lanka — local but no AI personalization',
        'Khan Academy — global, English-first, online-only',
        'YouTube tutorials — free but no structure or tracking',
      ],
      content: 'Global players lack localization; local players lack AI depth.',
      speakerNotes:
        'Position the wedge: AI + Sinhala/Tamil + offline. No competitor stacks all three.',
    },
    {
      slide: 8,
      layout: 'bullets',
      title: 'Go-to-Market',
      subtitle: 'School partnerships → parent referrals → ambassadors',
      bullets: [
        'Year 1 — 20 school pilots in Central & Northern provinces',
        'Year 2 — parent referral loops driven by progress reports',
        'Year 3 — community ambassador network across rural belts',
      ],
      content: 'School partnerships → parent referrals → community ambassadors.',
      speakerNotes:
        'Distribution is the moat — we land via schools, expand through families, and scale via local ambassadors.',
    },
    {
      slide: 9,
      layout: 'bullets',
      title: 'Team',
      subtitle: 'Education insiders + AI engineers',
      bullets: [
        'Founder — 10+ years building Sri Lankan curriculum programs',
        'CTO — Ex-Google AI, multilingual NLP background',
        'Head of Schools — former principal with 50+ partner network',
      ],
      content: 'Founders with 10+ years in Sri Lankan education and AI engineering.',
      speakerNotes:
        'Close on the people: deep local relationships paired with hard AI engineering. We can win this.',
    },
    {
      slide: 10,
      layout: 'metric',
      title: 'The Ask',
      subtitle: '$500K seed — 18 months runway',
      bullets: ['Product + curriculum: 40%', 'Pilot expansion: 35%', 'Team & ops: 25%'],
      content: 'Raising $500K seed for product, pilots, and team expansion.',
      speakerNotes:
        'We are raising $500K to expand pilots, harden the offline AI tutor, and hire two engineers. Join us.',
    },
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
    pressRelease: 'FOR IMMEDIATE RELEASE: Pitch Smasher Tutor brings AI-powered education to rural Sri Lanka...',
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

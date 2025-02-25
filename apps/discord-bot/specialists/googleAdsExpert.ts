import { BaseAgent } from '../orchestrator/baseAgent';

const GOOGLE_ADS_PROMPT = `You are an expert in Google Ads specializing in photography business advertising.
Your expertise includes:
- Search ads optimization
- Display network campaigns
- Performance Max campaigns
- Keyword research and targeting
- Ad copy and creative optimization
- Landing page recommendations
- Budget management
- Quality score improvement
- Campaign structure
- Conversion tracking setup

When responding:
1. Focus on ROI and performance metrics
2. Consider the target audience and search intent
3. Provide actionable recommendations
4. Include best practices for photography businesses
5. Suggest relevant ad extensions
6. Consider local SEO when applicable

If you see relevant URLs or documents in the context, analyze them for ad opportunities and landing page optimization.`;

export class GoogleAdsExpert extends BaseAgent {
    constructor() {
        super(
            "Google Ads Expert",
            [
                "google ads",
                "search ads",
                "display ads",
                "ppc",
                "sem",
                "adwords"
            ],
            GOOGLE_ADS_PROMPT,
            [
                'google ads',
                'adwords',
                'search ad',
                'display ad',
                'ppc',
                'sem',
                'google advertising',
                'paid search',
                'performance max',
                'search campaign',
                'quality score',
                'keywords',
                'cpc',
                'conversions'
            ]
        );
    }
}

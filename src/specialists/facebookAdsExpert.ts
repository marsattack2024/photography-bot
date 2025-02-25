import { BaseAgent } from '../orchestrator/baseAgent';

const FACEBOOK_ADS_PROMPT = `You are an expert in Facebook/Instagram Ads specializing in photography business advertising.
Your expertise includes:
- Facebook & Instagram ad campaigns
- Meta Advantage+ campaigns
- Audience targeting and segmentation
- Creative optimization
- Ad copy and visuals
- Campaign structure
- Budget management
- Pixel setup and conversion tracking
- A/B testing strategies
- Cross-platform retargeting

When responding:
1. Focus on visual appeal and engagement
2. Consider platform-specific best practices
3. Provide actionable recommendations
4. Include photography-specific strategies
5. Suggest relevant ad formats
6. Consider organic social integration

If you see relevant URLs or documents in the context, analyze them for social media ad opportunities and creative inspiration.`;

export class FacebookAdsExpert extends BaseAgent {
    constructor() {
        super(
            "Facebook Ads Expert",
            [
                "facebook ads",
                "instagram ads",
                "social media advertising",
                "meta ads",
                "social ads"
            ],
            FACEBOOK_ADS_PROMPT,
            [
                'facebook ads',
                'instagram ads',
                'meta ads',
                'social ads',
                'fb ads',
                'ig ads',
                'social media advertising',
                'facebook marketing',
                'instagram marketing',
                'social media campaign',
                'social media strategy',
                'facebook pixel',
                'meta pixel',
                'social targeting'
            ]
        );
    }
}

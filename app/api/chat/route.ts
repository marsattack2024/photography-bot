import { NextResponse } from 'next/server'
import { Orchestrator } from '@/orchestrator/orchestrator'
import { CopywritingExpert } from '@/specialists/copywritingExpert'
import { FacebookAdsExpert } from '@/specialists/facebookAdsExpert'
import { GoogleAdsExpert } from '@/specialists/googleAdsExpert'

// Initialize specialists and orchestrator
const specialists = [
  new CopywritingExpert(),
  new FacebookAdsExpert(),
  new GoogleAdsExpert(),
]

const orchestrator = new Orchestrator(specialists)

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Process the message through the orchestrator
    const response = await orchestrator.processRequest(message, {
      sessionId,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing chat request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
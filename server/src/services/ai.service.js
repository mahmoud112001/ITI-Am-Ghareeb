const OpenAI = require('openai')
const { buildSystemPrompt } = require('../ai/promptBuilder.js')
const { searchRoutes } = require('./routes.service.js')

/**
 * streamTransitAdvice — RAG pipeline:
 *  1. Query MongoDB for routes matching origin or destination
 *  2. Build a structured Arabic context string from the results
 *  3. Inject context into the Am Ghareeb system prompt
 *  4. Stream the OpenAI response back to the client via SSE
 *
 * SSE headers are set BEFORE the try block so the client can start listening.
 * OpenAI client is instantiated INSIDE the try block so a missing/invalid
 * API key throws inside the caught scope and sends an SSE error event
 * rather than crashing at module load time.
 */
async function streamTransitAdvice(origin, destination, userMessage, res) {
  // Set SSE headers before any async work — must come before try block
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // ── Step 1: DB lookup ───────────────────────────────────────────────────
    const routeResults = await searchRoutes(origin, destination, null, null)
    const itineraries = routeResults.slice(0, 5)

    // ── Step 2: Build Arabic context string ─────────────────────────────────
    const context =
      itineraries.length > 0
        ? itineraries
            .map((result) => {
              if (result.itineraryType === 'transfer') {
                const firstLeg = result.legs[0]
                const secondLeg = result.legs[1]
                return (
                  `رحلة بتحويلة واحدة عبر: ${result.transferPlace?.nameAr}\n` +
                  `الركوبة الأولى: ${firstLeg.route.nameAr}\n` +
                  `من: ${firstLeg.boardAt?.nameAr} إلى: ${firstLeg.alightAt?.nameAr}\n` +
                  `محطات الجزء الأول: ${firstLeg.route.stations.map((s) => s.nameAr).join(' ← ')}\n` +
                  `الركوبة الثانية: ${secondLeg.route.nameAr}\n` +
                  `من: ${secondLeg.boardAt?.nameAr} إلى: ${secondLeg.alightAt?.nameAr}\n` +
                  `محطات الجزء الثاني: ${secondLeg.route.stations.map((s) => s.nameAr).join(' ← ')}\n` +
                  `إجمالي التعريفة: ${result.totalFare?.min ?? 0}–${result.totalFare?.max ?? 0} جنيه`
                )
              }

              const route = result.route
              return (
                `خط: ${route.nameAr}\n` +
                `محطات: ${route.stations.map((s) => s.nameAr).join(' ← ')}\n` +
                `تعريفة: ${route.fare.min}–${route.fare.max} جنيه\n` +
                `أوقات الذروة: ${(route.peakHours || []).join(', ')}\n` +
                `نصائح: ${(route.tips || []).join('. ')}`
              )
            })
            .join('\n\n---\n\n')
        : 'لم يتم العثور على بيانات لهذا المسار في قاعدة البيانات.'

    // ── Step 3: Stream from OpenAI ──────────────────────────────────────────
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        { role: 'user', content: userMessage },
      ],
    })

    // ── Step 4: Forward each chunk to the client ────────────────────────────
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    // Cannot use next(err) after headers are flushed — send error via SSE
    res.write(`data: ${JSON.stringify({ error: 'حدث خطأ، حاول مرة تانية' })}\n\n`)
    res.end()
  }
}

module.exports = { streamTransitAdvice }

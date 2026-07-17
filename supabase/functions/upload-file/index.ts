import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting configuration
const RATE_LIMIT = {
  maxUploads: 15,           // Maximum uploads per window
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
}

// Allowed MIME types and their corresponding file signatures (magic bytes)
const allowedMimeTypes: Record<string, { extensions: string[], signatures: number[][] }> = {
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    signatures: [[0xFF, 0xD8, 0xFF]]
  },
  'image/png': {
    extensions: ['png'],
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]
  },
  'image/gif': {
    extensions: ['gif'],
    signatures: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]]
  },
  'image/webp': {
    extensions: ['webp'],
    signatures: [[0x52, 0x49, 0x46, 0x46]] // RIFF header, WebP follows
  },
  'application/pdf': {
    extensions: ['pdf'],
    signatures: [[0x25, 0x50, 0x44, 0x46]] // %PDF
  },
  'audio/mpeg': {
    extensions: ['mp3'],
    signatures: [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]] // MP3 frame sync or ID3
  },
  'audio/mp3': {
    extensions: ['mp3'],
    signatures: [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]]
  },
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TYPES = ['image', 'pdf', 'mp3']

function validateFileSignature(bytes: Uint8Array, mimeType: string): boolean {
  const config = allowedMimeTypes[mimeType]
  if (!config) return false
  
  return config.signatures.some(signature => {
    if (bytes.length < signature.length) return false
    return signature.every((byte, index) => bytes[index] === byte)
  })
}

function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes, limit length
  return filename
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\x00/g, '')
    .slice(0, 100)
}

function getClientIp(req: Request): string {
  // Try various headers in order of preference
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP if there are multiple
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  
  const cfConnectingIp = req.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }
  
  return 'unknown'
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

interface RateLimitRecord {
  client_ip: string
  upload_count: number
  window_start: string
}

async function checkRateLimit(supabase: any, clientIp: string): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT.windowMs)
  
  // Get existing rate limit record
  const { data: existing, error: selectError } = await supabase
    .from('upload_rate_limits')
    .select('*')
    .eq('client_ip', clientIp)
    .single() as { data: RateLimitRecord | null, error: any }
  
  if (selectError && selectError.code !== 'PGRST116') {
    // Error other than "no rows found"
    console.error('Rate limit check error:', selectError)
    // Allow upload on error to avoid blocking users
    return { allowed: true, remaining: RATE_LIMIT.maxUploads, resetAt: new Date(now.getTime() + RATE_LIMIT.windowMs) }
  }
  
  if (!existing) {
    // No record exists, create new one
    const { error: insertError } = await supabase
      .from('upload_rate_limits')
      .insert({
        client_ip: clientIp,
        upload_count: 1,
        window_start: now.toISOString(),
      })
    
    if (insertError) {
      console.error('Rate limit insert error:', insertError)
    }
    
    return { 
      allowed: true, 
      remaining: RATE_LIMIT.maxUploads - 1, 
      resetAt: new Date(now.getTime() + RATE_LIMIT.windowMs) 
    }
  }
  
  const existingWindowStart = new Date(existing.window_start)
  
  // Check if window has expired
  if (existingWindowStart < windowStart) {
    // Reset the window
    const { error: updateError } = await supabase
      .from('upload_rate_limits')
      .update({
        upload_count: 1,
        window_start: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('client_ip', clientIp)
    
    if (updateError) {
      console.error('Rate limit reset error:', updateError)
    }
    
    return { 
      allowed: true, 
      remaining: RATE_LIMIT.maxUploads - 1, 
      resetAt: new Date(now.getTime() + RATE_LIMIT.windowMs) 
    }
  }
  
  // Check if limit exceeded
  if (existing.upload_count >= RATE_LIMIT.maxUploads) {
    const resetAt = new Date(existingWindowStart.getTime() + RATE_LIMIT.windowMs)
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt 
    }
  }
  
  // Increment counter
  const { error: incrementError } = await supabase
    .from('upload_rate_limits')
    .update({
      upload_count: existing.upload_count + 1,
      updated_at: now.toISOString(),
    })
    .eq('client_ip', clientIp)
  
  if (incrementError) {
    console.error('Rate limit increment error:', incrementError)
  }
  
  const resetAt = new Date(existingWindowStart.getTime() + RATE_LIMIT.windowMs)
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.maxUploads - existing.upload_count - 1, 
    resetAt 
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create Supabase client with service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Get client IP and check rate limit
    const clientIp = getClientIp(req)
    const rateLimitResult = await checkRateLimit(supabase, clientIp)
    
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)
      console.log('Rate limit exceeded for IP:', clientIp)
      return new Response(
        JSON.stringify({ 
          error: 'Too many uploads. Please try again later.',
          retryAfter
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString()
          } 
        }
      )
    }

    // Parse form data with error handling
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (formError) {
      console.error('FormData parsing error:', formError)
      return new Response(
        JSON.stringify({ error: 'Invalid form data. Please ensure you are uploading a file correctly.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    // Validate required fields
    if (!file) {
      console.log('Upload failed: No file provided')
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!type || !VALID_TYPES.includes(type)) {
      console.log('Upload failed: Invalid type', type)
      return new Response(
        JSON.stringify({ error: 'Invalid file type category' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate MIME type
    if (!allowedMimeTypes[file.type]) {
      console.log('Upload failed: Invalid MIME type', file.type)
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, MP3' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('Upload failed: File too large', file.size)
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (file.size === 0) {
      console.log('Upload failed: Empty file')
      return new Response(
        JSON.stringify({ error: 'File is empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read file and validate magic bytes
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (!validateFileSignature(bytes, file.type)) {
      console.log('Upload failed: File signature mismatch for', file.type)
      return new Response(
        JSON.stringify({ error: 'File content does not match declared type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate secure filename
    const extension = getExtension(sanitizeFilename(file.name))
    const allowedExtensions = allowedMimeTypes[file.type].extensions
    
    if (!allowedExtensions.includes(extension)) {
      console.log('Upload failed: Extension mismatch', extension, allowedExtensions)
      return new Response(
        JSON.stringify({ error: 'File extension does not match file type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const uniqueFilename = `${type}/${crypto.randomUUID()}.${extension}`

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('qr-files')
      .upload(uniqueFilename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Storage upload error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('qr-files')
      .getPublicUrl(data.path)

    console.log('Upload successful:', uniqueFilename, 'IP:', clientIp, 'Remaining:', rateLimitResult.remaining)

    return new Response(
      JSON.stringify({ 
        success: true,
        url: urlData.publicUrl,
        path: data.path
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString()
        } 
      }
    )

  } catch (err) {
    console.error('Upload exception:', err)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred during upload' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

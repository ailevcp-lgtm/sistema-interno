const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')

const cwd = process.cwd()
console.log('CWD:', cwd)

const envPath = path.resolve(cwd, '.env.local')
console.log('Checking .env.local at:', envPath)
if (fs.existsSync(envPath)) {
    console.log('Found .env.local')
    const result = dotenv.config({ path: envPath })
    if (result.error) console.error('Error loading .env.local:', result.error)
} else {
    console.log('Not found .env.local')
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL Present:', !!url)
console.log('Service Key Present:', !!key)
console.log('Anon Key Present:', !!anon)

if (key && key === anon) {
    console.warn('WARNING: Service Key is same as Anon Key!')
} else if (key) {
    console.log('Service Key is distinct from Anon Key.')
}

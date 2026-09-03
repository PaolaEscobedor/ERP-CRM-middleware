const axios = require('axios');

// 1. PEGA TUS CREDENCIALES DIRECTAMENTE AQUÍ (Sin usar process.env)
const CLIENT_ID = '1000.LPIWSUAI8ZVFKB35J8VY13LZ3WIAPA';
const CLIENT_SECRET = 'f2cb99177c6d05663f8d8491fc9b34c619717a109e';
const REDIRECT_URI = 'http://localhost:3000/callback';

// 2. PEGA TU NUEVO CÓDIGO AQUÍ (El que saques del navegador)
const GRANT_CODE = '1000.b2b1bd4a9f3a88891d7a07e556633a68.b3d25e27d4b235d23e60a7086f7d6312'; 

async function initializeOAuth() {
    try {
        console.log('🚀 Solicitando tokens a Zoho (Modo Blindado)...');
        
        // 3. Forzamos el formato x-www-form-urlencoded que Zoho prefiere
        const payload = new URLSearchParams();
        payload.append('grant_type', 'authorization_code');
        payload.append('client_id', CLIENT_ID.trim());
        payload.append('client_secret', CLIENT_SECRET.trim());
        payload.append('redirect_uri', REDIRECT_URI);
        payload.append('code', GRANT_CODE.trim()); // Trim quita espacios invisibles

        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', payload);

        console.log('\n================ RESPUESTA COMPLETA DE ZOHO ================');
        console.log(response.data);
        
        if (response.data.refresh_token) {
            console.log('\n===========================================================');
            console.log(`✅ ¡ÉXITO! TU NUEVO REFRESH TOKEN ES:`);
            console.log(response.data.refresh_token);
            console.log('===========================================================\n');
            console.log('👉 Ahora sí, cópialo y ponlo en tu archivo .env');
        } else {
            console.log('⚠️ No se recibió refresh_token.');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.response ? error.response.data : error.message);
    }
}

initializeOAuth();
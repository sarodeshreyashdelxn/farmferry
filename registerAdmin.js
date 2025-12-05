const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function registerAdmin() {
  const API_BASE_URL = process.env.BACKEND_API_BASE_URL || 'http://localhost:9000';
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'FarmFerry Admin',
      email: 'prathameshnarawade.delxn@gmail.com',
      password: 'pass123456'
    })
  });
  const data = await response.json();
  console.log(data);
}

registerAdmin(); 
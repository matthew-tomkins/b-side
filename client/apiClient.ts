import request from 'superagent'

const rootURL = new URL(`/api/v1`, document.baseURI)

export async function getGreeting() {
  const res = await request.get(`${rootURL}/greeting`)
  return res.body.greeting as string
}
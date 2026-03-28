import client from "./client";

export async function startScan(domainName) {
  const response = await client.post("/scan/start", { domain_name: domainName });
  return response.data;
}

export async function getScanStatus(taskId) {
  const response = await client.get(`/scan/status/${taskId}`);
  return response.data;
}

export async function getScanResults(domainId) {
  const response = await client.get(`/scan/${domainId}/results`);
  return response.data;
}

export async function getScore(domainId) {
  const response = await client.get(`/scan/${domainId}/score`);
  return response.data;
}

export async function getScoreHistory(domainId) {
  const response = await client.get(`/scan/${domainId}/history`);
  return response.data;
}

export async function getRecentDomain() {
  const response = await client.get("/scan/recent-domain");
  return response.data;
}

export async function getDemoResults() {
  const response = await client.get("/demo/results");
  return response.data;
}

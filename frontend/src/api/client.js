import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("vsoToken");
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

export default client;

import axios, { AxiosError, AxiosResponse } from 'axios';
import type { AxiosRequestConfig } from 'axios';
import express, { Router } from 'express';

const cocapi = Router();

cocapi.use(express.json());
cocapi.use(express.urlencoded({ extended: true }));

cocapi.get('/cocapi', (req, res) => {
    res.json({ application: 'Clash Of Clans API Gateway', status: 'ok' });
});

cocapi.use('/cocapi/*', async (req, res) => {
    if(req.headers.authorization !== process.env.SECRET) {
        return res.status(401).send({reason: "Invalid secret sent to the gateway"});
    } 

    const url = req.originalUrl.replace('/cocapi', '');
    const token = await getKeyForCurrentIP(res);
    if(token == null)
        return; // It means there was an error and response have been sent.

    const axiosConfig: AxiosRequestConfig = {
        baseURL: "https://api.clashofclans.com/",
        headers: { Authorization: "Bearer " + token }
    };
    
    const handleResponse = (response: AxiosResponse) => {
        res.status(response.status).json(response.data);
    }

    axios.get(url, axiosConfig)
    .then(handleResponse)
    .catch((err: AxiosError) => {
        console.error(err);
        if(err.response)
            handleResponse(err.response);
        else
            res.status(400).json({reason:"Unknown error durring COC API call"});
    });
});

const login = async ({ baseUrl, email, password }) => {
    try {
      const url = `${baseUrl}/login`
      const payload = { email, password }
      const login = await axios.post(url, payload)
      return login
    } catch (error) {
      return error?.response?.data
    }
  }
  
  const getKeys = async ({ baseUrl, cookie }) => {
    try {
      const url = `${baseUrl}/apikey/list`
      const headers = { cookie }
      const response = await axios.post(url, {}, { headers })
      return response.data.keys
    } catch (error) {
      return error?.response?.data
    }
  }
  
  const revokeKey = async ({ baseUrl, cookie, keyToRevoke }) => {
    try {
      const url = `${baseUrl}/apikey/revoke`
      const headers = { cookie }
      const data = { id: keyToRevoke.id }
      await axios.post(url, data, { headers })
    } catch (error) {
      return error?.response?.data
    }
  }
  
  const createKey = async ({ baseUrl, cookie, ips }) => {
    try {
      const url = `${baseUrl}/apikey/create`
      const headers = { cookie }
      const payload = {
        cidrRanges: ips,
        name: 'Key generated at ' + new Date().toISOString(),
        description: 'Key for non-commercial use'
      }
      const response = await axios.post(url, payload, { headers })
      return response.data
    } catch (error) {
      return error?.response?.data
    }
  }
  
  const getCookie = async loginResponse => {
    const sessionDetails = loginResponse.headers['set-cookie'][0]
    const cookie = `${sessionDetails}; game-api-url=${loginResponse.data.swaggerUrl};game-api-token=${loginResponse.data.temporaryAPIToken}`
    return cookie
  }
  
  const getIP = async () => {
    const url = 'https://api.ipify.org/'
    const response = await axios.get(url)
    return response.data
  }
  
  const getKeyForCurrentIP = async (res) => {
    try {
      const email = process.env.SC_DEV_EMAIL;
      const password = process.env.SC_DEV_PASSWORD;
  
      if (!email || !password) {
        res.status(400).json({ reason: 'email and password are required' })
        return null;
      }
  
      const baseUrl = `https://developer.clashofclans.com/api`
  
      // login
      const loginResponse = await login({ baseUrl, email, password })
      if (loginResponse?.error) {
        res.status(401).send(loginResponse)
        return null;
      }
  
      // get cookie
      const cookie = await getCookie(loginResponse)
  
      // get current keys:
      const savedKeys = await getKeys({ baseUrl, cookie })
  
      // get current IP
      const ip = await getIP()
  
      // check if exists a key with the same IP:
      const keyWithSameIP = savedKeys.find(key => key.cidrRanges.includes(ip))
  
      let validApiKey
      if (keyWithSameIP) {
        validApiKey = keyWithSameIP
      } 
      else {
        // revoke the first key
        if (savedKeys.length === 10) {
          const keyToRevoke = savedKeys[0];
          await revokeKey({ baseUrl, cookie, keyToRevoke })
        }
  
        let ips = [ip];
        for(let i=0; ips.length<5 && i < savedKeys.length -1; i++) {
          let keyIps = savedKeys[i].cidrRanges;
          for(let j=0; j<keyIps.length && ips.length<5; j++) {
            ips.push(keyIps[j]);
          }
        }
  
        // create new key
        const newKey = await createKey({ baseUrl, cookie, ips})
        if (newKey?.error) {
          res.status(500).send(newKey)
          return null;
        }
  
        validApiKey = newKey.key
      }
      return validApiKey.key;
    } 
    catch (error) {
      console.error(error)
      res.status(500).json({ error })
    }
  }

export default cocapi;

# Clash of Clans API Gateway

This project is a fork from https://github.com/buster95/clashofclans_gateway and https://github.com/marsidev/get-sc-key.

## Purpose
The goal is to do your own gateway in an environnement where your IP is not fixed (often the case in the cloud). This gateway will determine it's current IP, then will connect to your supercell developper account to check if a key exists for this IP. If it doesn't exist, it will create a key for the new IP, 4 other IPs from you first keys. If you already have 10 keys, it'll delete the first one.

## Env Variable
This gateway requires 4 environnements variables : PORT, SC_DEV_EMAIL, SC_DEV_PASSWORD and SECRET
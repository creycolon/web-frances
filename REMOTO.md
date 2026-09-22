# Acceso remoto (Ubuntu) y uso compartido

La app es estática y `serve.js` escucha en `0.0.0.0:8080`. Para acceder desde fuera
de tu red y compartirla con un compañero, lo más simple y **privado** es **Tailscale**.

## 1) Instalar Tailscale (Ubuntu)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

- El comando `tailscale up` imprime una URL: ábrela y entra con Google/GitHub/Microsoft
  para vincular tu máquina.
- Compruébalo con `tailscale ip -4` (te da la IP privada de tu PC en Tailscale).

## 2) Arrancar la app

```bash
cd /mnt/sda2/github/web-frances
./start.sh          # o: node serve.js  →  http://localhost:8080
```

## 3) Permitir el puerto en el cortafuegos (solo si usas ufw)

```bash
sudo ufw allow in on tailscale0 to any port 8080
```

## 4) Acceder desde otro dispositivo

1. Instala Tailscale en el teléfono/PC del compañero (misma cuenta o invítalo).
2. Abre:
   ```
   http://100.x.y.z:8080        ← la IP que da `tailscale ip -4`
   ```
   o, si funciona la resolución de nombres:
   ```
   http://<nombre-de-tu-pc>:8080
   ```

## 5) Compartir con un compañero

En la consola <https://login.tailscale.com/admin/machines>:

- Botón **Share…** sobre tu máquina → escribe su correo, o
- **Invite users** para añadirlo a tu *tailnet*.

Solo entra quien tú invites; el tráfico va cifrado de extremo a extremo.

## 6) (Opcional) Que la app arranque sola al encender el PC

```bash
# 1) ver la ruta de node
which node

# 2) copiar y ajustar el servicio
sudo cp edito-a1.service /etc/systemd/system/edito-a1.service
sudo nano /etc/systemd/system/edito-a1.service   # ajusta WorkingDirectory y ExecStart

# 3) activarlo
sudo systemctl daemon-reload
sudo systemctl enable --now edito-a1.service
sudo systemctl status edito-a1.service
```

Después la app estará siempre disponible en `http://<ip-tailscale>:8080`.

## Alternativa: Cloudflare Tunnel (URL rápida, sin que instalen nada)

```bash
# instalar cloudflared (una vez): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8080
```

Imprime una URL `https://xxxx.trycloudflare.com`. ⚠️ Esa URL es **pública**; para pedir
login usa *Cloudflare Tunnel + Access* (requiere dominio).

## Nota importante

Édito A1 es material con **derechos de autor**. Compártelo solo de forma **privada**
y con personas de confianza, no en un hosting público.

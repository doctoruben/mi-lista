import os
import json
import urllib.request

TELEGRAM_TOKEN   = os.environ["TELEGRAM_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
FIREBASE_URL     = os.environ["FIREBASE_URL"]


def fetch(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())


def patch(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="PATCH"
    )
    with urllib.request.urlopen(req, timeout=10):
        pass


def send_telegram(msg):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10):
        pass


def feur(v):
    return f"{float(v):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def check_threshold(label, threshold, triggered, alerted_key, current_value, price_eur, btc_amount):
    """Comprueba un umbral (arriba o abajo) y devuelve el patch necesario para Firebase."""
    if threshold is None:
        return {}

    direction_up = label == "above"
    hit = (direction_up and current_value >= float(threshold)) or \
          (not direction_up and current_value <= float(threshold))

    emoji  = "🚀" if direction_up else "📉"
    word   = "superado" if direction_up else "bajado de"
    label_es = "superior" if direction_up else "inferior"

    if hit and not alerted_key:
        msg = (
            f"<b>{emoji} Alerta Bitcoin — umbral {label_es} alcanzado</b>\n\n"
            f"Tu cartera ha {word} el umbral configurado.\n\n"
            f"💰 <b>Valor actual:</b> {feur(current_value)}\n"
            f"🎯 <b>Umbral {label_es}:</b> {feur(threshold)}\n"
            f"₿ <b>Cantidad:</b> {btc_amount} BTC\n"
            f"📈 <b>Precio BTC:</b> {feur(price_eur)}"
        )
        send_telegram(msg)
        print(f"✅ Alerta {label_es} enviada.")
        return {f"alerted_{label}": True}

    elif not hit and alerted_key:
        # El precio salió del umbral — resetear para poder volver a avisar
        print(f"ℹ️  Umbral {label_es} ya no activo — reseteando.")
        return {f"alerted_{label}": False}

    elif hit and alerted_key:
        print(f"Umbral {label_es} activo pero alerta ya enviada. Sin acción.")

    else:
        print(f"Umbral {label_es} no alcanzado.")

    return {}


def main():
    # 1. Leer config desde Firebase
    config = fetch(f"{FIREBASE_URL}/btc_tracker_alert.json")

    if not config:
        print("No hay configuración de alerta en Firebase. Nada que hacer.")
        return

    btc_amount     = config.get("btc_amount")
    alert_above    = config.get("alert_above")     # umbral superior en €
    alert_below    = config.get("alert_below")     # umbral inferior en €
    alerted_above  = config.get("alerted_above", False)
    alerted_below  = config.get("alerted_below", False)

    if not btc_amount or (alert_above is None and alert_below is None):
        print("Faltan datos (btc_amount o umbrales). Nada que hacer.")
        return

    # 2. Precio actual BTC en EUR
    rates = fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC")
    price_eur     = float(rates["data"]["rates"]["EUR"])
    current_value = float(btc_amount) * price_eur

    print(f"Precio BTC:    {feur(price_eur)}")
    print(f"Valor cartera: {feur(current_value)}  ({btc_amount} BTC)")
    if alert_above: print(f"Umbral subida: {feur(alert_above)}  (alertado: {alerted_above})")
    if alert_below: print(f"Umbral bajada: {feur(alert_below)}  (alertado: {alerted_below})")

    # 3. Comprobar ambos umbrales
    updates = {}
    updates.update(check_threshold("above", alert_above, alerted_above, alerted_above, current_value, price_eur, btc_amount))
    updates.update(check_threshold("below", alert_below, alerted_below, alerted_below, current_value, price_eur, btc_amount))

    # 4. Guardar cambios en Firebase si los hay
    if updates:
        patch(f"{FIREBASE_URL}/btc_tracker_alert.json", updates)
        print(f"✅ Firebase actualizado: {updates}")


if __name__ == "__main__":
    main()

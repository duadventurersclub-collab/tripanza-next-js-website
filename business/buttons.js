const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

async function sendInteractive(sock, jid, content) {
    const { __interactiveButtons: buttons, ...plain } = content;
    if (!buttons?.length) return sock.sendMessage(jid, plain);
    // Keep the fallback even if constructing or relaying the experimental card fails.
    const sent = await sock.sendMessage(jid, plain);
    try {
        const interactive = proto.Message.InteractiveMessage.create({
            body: { text: plain.text }, footer: { text: 'Tripanza' },
            nativeFlowMessage: { buttons: buttons.map(button => ({
                name: button.kind === 'url' ? 'cta_url' : 'quick_reply',
                buttonParamsJson: JSON.stringify(button.kind === 'url'
                    ? { display_text: button.label, url: button.value, merchant_url: button.value }
                    : { display_text: button.label, id: button.value }),
            })) },
        });
        const message = generateWAMessageFromContent(jid, { viewOnceMessage: { message: { interactiveMessage: interactive } } }, { userJid: sock.user?.id });
        await sock.relayMessage(jid, message.message, { messageId: message.key.id });
    }
    catch { /* The original readable message was already accepted. */ }
    return sent;
}
module.exports = { sendInteractive };

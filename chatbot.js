/**
 * OdiseaBot - Asistente Interactivo Oficial para Odisea Challenge
 */

(function () {
    // Configuración general del ChatBot
    const CONFIG = {
        botName: 'OdiseaBot 🤖',
        welcomeMessage: '¡Hola! Soy **OdiseaBot**, tu asistente oficial de **Odisea Challenge**. ¿En qué te puedo orientar hoy?',
        whatsappUrl: 'https://wa.me/5214151234567?text=Hola,%20requiero%20atenci%C3%B3n%20personalizada%20para%20Odisea%20Challenge',
        telegramUrl: 'https://t.me/OdiseaChallengeBot',
        apiBase: 'https://api.odiseachallenge.com'
    };

    // Base de conocimiento e Intenciones (NLU local)
    const INTENTS = [
        {
            keywords: ['incluye', 'que incluye', 'incluidas', 'paquete', 'beneficios', 'comida', 'transporte'],
            response: `🎉 **¡Tu viaje Odisea Challenge incluye TODO en 1 solo día!**<br><br>
👉 <strong>Transporte redondo</strong> en unidad ejecutiva de lujo.<br>
👉 <strong>Entradas 100% Incluidas</strong> a los 4 destinos (Acuario Inbursa, Acuario Interactivo, Museo Soumaya y Odisea México / Simulador FlyOver).<br>
👉 <strong>Comida incluida</strong> en La Casa de Toño.<br>
👉 <strong>Juego Interactivo</strong> durante el trayecto para ganar viaje GRATIS ($0 costo).<br>
👉 <strong>Seguro de viajero</strong> y coordinador de grupo.`
        },
        {
            keywords: ['comprar entradas', 'sitio oficial', 'entradas aparte', 'comprar por fuera', 'boletos aparte'],
            response: `⚠️ <strong>¡ACLARACIÓN IMPORTANTE!</strong><br><br>
<strong>NO necesitas comprar entradas por separado</strong> en las páginas oficiales de los acuarios o museos.<br><br>
Todas las entradas ya vienen <strong>100% INCLUIDAS</strong> en tu pase de abordaje. Muestra tu código QR en el andén y nosotros nos encargamos del acceso.`
        },
        {
            keywords: ['salida', 'salidas', 'origen', 'donde sale', 'punto de encuentro', 'horario', 'camioneta', 'autobus'],
            response: `🚌 <strong>Puntos de Salida Disponibles:</strong><br><br>
Ofrecemos salidas semanales desde:<br>
• <strong>San Miguel de Allende</strong><br>
• <strong>Dolores Hidalgo</strong><br>
• <strong>Querétaro</strong><br>
• <strong>Guanajuato / Celaya / Pachuca</strong><br><br>
Puedes revisar las fechas y lugares disponibles dando clic en el botón <strong>"Ver Salidas"</strong>.`
        },
        {
            keywords: ['gratis', 'juego', 'ganar', 'costo 0', 'como gano', 'trivia'],
            response: `🏆 <strong>¿Cómo tener tu Viaje Gratis ($0 costo)?</strong><br><br>
Durante el viaje en autobús participas en nuestro <em>Juego Interactivo Odisea</em> con dinámicas y trivias. ¡Si ganas el reto, te reembolsamos el 100% del costo de tu viaje al instante!`
        },
        {
            keywords: ['mi boleto', 'mis boletos', 'pase', 'qr', 'donde veo', 'consultar', 'recuperar'],
            response: `🎟️ <strong>Consulta de Pases Móviles QR:</strong><br><br>
Puedes ingresar tu correo electrónico registrado desde la opción <strong>"Consultar Mis Boletos"</strong> en el menú de inicio o al final del pase de abordaje digital.`
        },
        {
            keywords: ['precio', 'costo', 'cuanto cuesta', 'valor', 'tarifa', 'pagar'],
            response: `💲 <strong>Tarifa Todo Incluido:</strong><br><br>
El precio de tu Odisea va desde <strong>$1,199 MXN por persona</strong> e incluye todo el itinerario: transporte, entradas a las 4 atracciones, comida, seguro y juego por el viaje gratis.`
        },
        {
            keywords: ['humano', 'soporte', 'whatsapp', 'telegram', 'hablar', 'persona', 'telefono', 'agente', 'contacto'],
            response: `💬 <strong>Atención Personalizada por Agente Humano:</strong><br><br>
Si necesitas apoyo especial o resolver alguna duda específica, contáctanos directamente por <strong>WhatsApp</strong> o <strong>Telegram</strong> con los botones aquí abajo:`
        }
    ];

    // CSS Estilos inyectados
    const CSS_STYLES = `
        #odisea-chat-widget {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            z-index: 99999;
        }

        #odisea-chat-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5), 0 0 0 4px rgba(249, 115, 22, 0.2);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: none;
            outline: none;
        }

        #odisea-chat-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 15px 30px -5px rgba(234, 88, 12, 0.6), 0 0 0 6px rgba(249, 115, 22, 0.3);
        }

        .odisea-chat-badge {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 16px;
            height: 16px;
            background: #10b981;
            border: 2px solid #0f172a;
            border-radius: 50%;
            animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        #odisea-chat-window {
            position: fixed;
            bottom: 95px;
            right: 24px;
            width: 360px;
            max-width: calc(100vw - 32px);
            height: 520px;
            max-height: calc(100vh - 120px);
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #odisea-chat-window.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        .chat-header {
            background: linear-gradient(to right, #0f172a, #1e293b);
            padding: 16px;
            border-b: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .chat-message {
            max-width: 85%;
            padding: 12px 14px;
            border-radius: 16px;
            font-size: 13px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .chat-message.bot {
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid rgba(255, 255, 255, 0.05);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }

        .chat-message.user {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: #ffffff;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            font-weight: 500;
        }

        .chat-chips {
            padding: 8px 16px;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            white-space: nowrap;
            border-t: 1px solid rgba(255, 255, 255, 0.05);
            scrollbar-width: none;
        }

        .chat-chips::-webkit-scrollbar { display: none; }

        .chat-chip {
            background: rgba(255, 255, 255, 0.08);
            hover: background: rgba(249, 115, 22, 0.2);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .chat-chip:hover {
            background: rgba(249, 115, 22, 0.2);
            border-color: #f97316;
            color: #ffffff;
        }

        .chat-input-area {
            padding: 12px 16px;
            background: #0f172a;
            border-t: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            gap: 8px;
        }

        .chat-input {
            flex: 1;
            background: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 10px 14px;
            color: #ffffff;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
        }

        .chat-input:focus {
            border-color: #f97316;
        }

        .chat-send-btn {
            background: #f97316;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            padding: 0 14px;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .chat-send-btn:hover {
            background: #ea580c;
        }

        .support-links {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .support-btn-wa {
            background: #25D366;
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .support-btn-tg {
            background: #0088cc;
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
    `;

    // HTML inyectado
    function createWidgetHTML() {
        const div = document.createElement('div');
        div.id = 'odisea-chat-widget';
        div.innerHTML = `
            <style>${CSS_STYLES}</style>
            
            <!-- Botón Flotante -->
            <button id="odisea-chat-btn" aria-label="Abrir Chat de Ayuda">
                <span class="odisea-chat-badge"></span>
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:28px;height:28px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"></path>
                </svg>
            </button>

            <!-- Ventana del Chat -->
            <div id="odisea-chat-window">
                <!-- Header -->
                <div class="chat-header">
                    <div class="flex items-center gap-3" style="display:flex;align-items:center;gap:10px;">
                        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:16px;">
                            🤖
                        </div>
                        <div>
                            <div style="color:#ffffff;font-weight:bold;font-size:14px;line-height:1.2;">${CONFIG.botName}</div>
                            <div style="color:#10b981;font-size:10px;font-weight:600;">● En línea • Asistente Oficial</div>
                        </div>
                    </div>
                    <button id="odisea-chat-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px;">✕</button>
                </div>

                <!-- Lista de Mensajes -->
                <div class="chat-messages" id="chat-messages-list">
                    <!-- Los mensajes se insertan dinámicamente -->
                </div>

                <!-- Atajos Rápido (Chips) -->
                <div class="chat-chips">
                    <button class="chat-chip" onclick="OdiseaBot.sendChip('¿Qué incluye mi boleto?')">🎟️ ¿Qué incluye?</button>
                    <button class="chat-chip" onclick="OdiseaBot.sendChip('¿Dónde se compra o se entra?')">⚠️ ¿Entradas incluidas?</button>
                    <button class="chat-chip" onclick="OdiseaBot.sendChip('Puntos de salida')">🚌 Puntos de Salida</button>
                    <button class="chat-chip" onclick="OdiseaBot.sendChip('¿Cómo ganar viaje gratis?')">🏆 Viaje Gratis $0</button>
                    <button class="chat-chip" onclick="OdiseaBot.sendChip('Hablar con agente humano')">💬 Soporte Humano</button>
                </div>

                <!-- Input Area -->
                <div class="chat-input-area">
                    <input type="text" id="chat-input-field" class="chat-input" placeholder="Escribe tu duda aquí..." onkeypress="if(event.key==='Enter') OdiseaBot.handleSend()">
                    <button class="chat-send-btn" onclick="OdiseaBot.handleSend()">Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    // Lógica principal del ChatBot
    window.OdiseaBot = {
        isOpen: false,
        messages: [],

        init() {
            createWidgetHTML();
            this.bindEvents();
            this.loadHistory();
        },

        bindEvents() {
            document.getElementById('odisea-chat-btn').addEventListener('click', () => this.toggle());
            document.getElementById('odisea-chat-close').addEventListener('click', () => this.toggle());
        },

        toggle() {
            this.isOpen = !this.isOpen;
            const win = document.getElementById('odisea-chat-window');
            if (this.isOpen) {
                win.classList.add('active');
                if (this.messages.length === 0) {
                    this.addBotMessage(CONFIG.welcomeMessage);
                }
                document.getElementById('chat-input-field').focus();
            } else {
                win.classList.remove('active');
            }
        },

        loadHistory() {
            try {
                const saved = sessionStorage.getItem('odiseabot_history');
                if (saved) {
                    this.messages = JSON.parse(saved);
                    this.renderMessages();
                }
            } catch (e) {
                console.warn(e);
            }
        },

        saveHistory() {
            try {
                sessionStorage.setItem('odiseabot_history', JSON.stringify(this.messages));
            } catch (e) {}
        },

        renderMessages() {
            const container = document.getElementById('chat-messages-list');
            if (!container) return;
            container.innerHTML = this.messages.map(m => `
                <div class="chat-message ${m.sender}">
                    ${m.text}
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        },

        addUserMessage(text) {
            this.messages.push({ sender: 'user', text: text });
            this.renderMessages();
            this.saveHistory();
        },

        addBotMessage(text) {
            this.messages.push({ sender: 'bot', text: text });
            this.renderMessages();
            this.saveHistory();
        },

        sendChip(text) {
            this.addUserMessage(text);
            this.processInput(text);
        },

        handleSend() {
            const input = document.getElementById('chat-input-field');
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            this.addUserMessage(text);
            this.processInput(text);
        },

        processInput(text) {
            const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Buscar coincidencia en INTENTS
            let matched = null;
            for (let intent of INTENTS) {
                if (intent.keywords.some(k => cleanText.includes(k))) {
                    matched = intent;
                    break;
                }
            }

            // Simular respuesta con leve delay natural
            setTimeout(() => {
                if (matched) {
                    let responseText = matched.response;
                    if (cleanText.includes('humano') || cleanText.includes('contacto') || cleanText.includes('agente') || cleanText.includes('soporte')) {
                        responseText += `
                            <div class="support-links">
                                <a href="${CONFIG.whatsappUrl}" target="_blank" class="support-btn-wa">📲 WhatsApp</a>
                                <a href="${CONFIG.telegramUrl}" target="_blank" class="support-btn-tg">✈️ Telegram</a>
                            </div>
                        `;
                    }
                    this.addBotMessage(responseText);
                } else {
                    this.addBotMessage(`
                        Gracias por tu pregunta. 🤔 Puedo ayudarte con:
                        <br>• <strong>¿Qué incluye tu boleto?</strong>
                        <br>• <strong>Puntos de Salida y Horarios</strong>
                        <br>• <strong>Cómo ganar tu viaje gratis</strong>
                        <br><br>Si deseas hablar directamente con un asesor, da clic a continuación:
                        <div class="support-links">
                            <a href="${CONFIG.whatsappUrl}" target="_blank" class="support-btn-wa">📲 WhatsApp</a>
                            <a href="${CONFIG.telegramUrl}" target="_blank" class="support-btn-tg">✈️ Telegram</a>
                        </div>
                    `);
                }
            }, 400);
        }
    };

    // Auto-inicialización al cargar el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => OdiseaBot.init());
    } else {
        OdiseaBot.init();
    }
})();

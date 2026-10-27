/* SiteChat widget — free AI chatbot. Embed: <script src="WIDGET_URL" data-site="thedesignpk" data-api="API_URL"></script>
   Optional multilingual mode: data-langs="en,es,fr" adds a language selector,
   localizes the widget UI, and asks the API to answer in the chosen language.
   Without data-langs the widget behaves exactly as the original English one. */
(function () {
  var script = document.currentScript;
  var SITE = script.getAttribute('data-site') || 'default';
  var API = (script.getAttribute('data-api') || '').replace(/\/$/, '');
  if (!API) return;
  var COLOR = script.getAttribute('data-color') || '#fe1f07';

  /* ---- language metadata: native names + UI strings ---- */
  var LANG_META = {
    en: { name: 'English', dir: 'ltr', s: { title: 'Ask us anything', greeting: 'Hi! Ask me anything about this site — services, pricing, contact info.', placeholder: 'Type your question...', typing: 'Typing...', sources: 'Sources:', error: 'Something went wrong. Please try again.', conn: 'Connection error. Please try again.' } },
    es: { name: 'Español', dir: 'ltr', s: { title: 'Pregúntenos lo que quiera', greeting: '¡Hola! Pregúnteme lo que quiera sobre este sitio: servicios, precios e información de contacto.', placeholder: 'Escriba su pregunta...', typing: 'Escribiendo...', sources: 'Fuentes:', error: 'Algo salió mal. Inténtelo de nuevo.', conn: 'Error de conexión. Inténtelo de nuevo.' } },
    fr: { name: 'Français', dir: 'ltr', s: { title: 'Posez-nous vos questions', greeting: 'Bonjour ! Posez-moi vos questions sur ce site : services, tarifs et coordonnées.', placeholder: 'Écrivez votre question...', typing: 'Écriture...', sources: 'Sources :', error: "Une erreur s'est produite. Veuillez réessayer.", conn: 'Erreur de connexion. Veuillez réessayer.' } },
    de: { name: 'Deutsch', dir: 'ltr', s: { title: 'Fragen Sie uns alles', greeting: 'Hallo! Fragen Sie mich alles über diese Website — Leistungen, Preise und Kontaktinformationen.', placeholder: 'Geben Sie Ihre Frage ein...', typing: 'Schreibt...', sources: 'Quellen:', error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', conn: 'Verbindungsfehler. Bitte versuchen Sie es erneut.' } },
    pt: { name: 'Português', dir: 'ltr', s: { title: 'Pergunte o que quiser', greeting: 'Olá! Pergunte-me qualquer coisa sobre este site — serviços, preços e informações de contato.', placeholder: 'Digite sua pergunta...', typing: 'Digitando...', sources: 'Fontes:', error: 'Algo deu errado. Tente novamente.', conn: 'Erro de conexão. Tente novamente.' } },
    hi: { name: 'हिन्दी', dir: 'ltr', s: { title: 'हमसे कुछ भी पूछें', greeting: 'नमस्ते! इस वेबसाइट के बारे में कुछ भी पूछें — सेवाएँ, कीमतें और संपर्क जानकारी।', placeholder: 'अपना प्रश्न लिखें...', typing: 'लिख रहे हैं...', sources: 'स्रोत:', error: 'कुछ गड़बड़ हो गई। कृपया फिर से प्रयास करें।', conn: 'कनेक्शन त्रुटि। कृपया फिर से प्रयास करें।' } },
    ur: { name: 'اردو', dir: 'rtl', s: { title: 'ہم سے کچھ بھی پوچھیں', greeting: 'السلام علیکم! اس ویب سائٹ کے بارے میں کچھ بھی پوچھیں — خدمات، قیمتیں اور رابطے کی معلومات۔', placeholder: 'اپنا سوال لکھیں...', typing: 'لکھ رہے ہیں...', sources: 'ذرائع:', error: 'کچھ خرابی ہو گئی۔ براہ کرم دوبارہ کوشش کریں۔', conn: 'رابطے کی خرابی۔ براہ کرم دوبارہ کوشش کریں۔' } },
    ar: { name: 'العربية', dir: 'rtl', s: { title: 'اسألنا أي شيء', greeting: 'مرحبًا! اسألني أي شيء عن هذا الموقع — الخدمات والأسعار ومعلومات التواصل.', placeholder: 'اكتب سؤالك...', typing: 'جارٍ الكتابة...', sources: 'المصادر:', error: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.', conn: 'خطأ في الاتصال. يرجى المحاولة مرة أخرى.' } },
    zh: { name: '中文', dir: 'ltr', s: { title: '有问题随时问', greeting: '您好！关于本网站的任何问题都可以问我 — 服务、价格和联系方式。', placeholder: '请输入您的问题...', typing: '正在输入...', sources: '来源：', error: '出了点问题，请重试。', conn: '连接错误，请重试。' } },
    ru: { name: 'Русский', dir: 'ltr', s: { title: 'Спрашивайте о чём угодно', greeting: 'Здравствуйте! Спрашивайте меня о чём угодно на этом сайте — услуги, цены и контактная информация.', placeholder: 'Введите ваш вопрос...', typing: 'Печатает...', sources: 'Источники:', error: 'Что-то пошло не так. Попробуйте ещё раз.', conn: 'Ошибка подключения. Попробуйте ещё раз.' } },
    ja: { name: '日本語', dir: 'ltr', s: { title: '何でも聞いてください', greeting: 'こんにちは！このサイトについて何でも聞いてください — サービス、料金、連絡先情報。', placeholder: '質問を入力してください...', typing: '入力中...', sources: '出典:', error: '問題が発生しました。もう一度お試しください。', conn: '接続エラーです。もう一度お試しください。' } },
    id: { name: 'Bahasa Indonesia', dir: 'ltr', s: { title: 'Tanyakan apa saja', greeting: 'Halo! Tanyakan apa saja tentang situs ini — layanan, harga, dan info kontak.', placeholder: 'Ketik pertanyaan Anda...', typing: 'Mengetik...', sources: 'Sumber:', error: 'Terjadi kesalahan. Silakan coba lagi.', conn: 'Kesalahan koneksi. Silakan coba lagi.' } }
  };

  var langsAttr = (script.getAttribute('data-langs') || '').split(',')
    .map(function (c) { return c.trim().toLowerCase(); })
    .filter(function (c) { return !!LANG_META[c]; });
  var MULTI = langsAttr.length > 0;
  var curLang = 'en';
  if (MULTI) {
    curLang = langsAttr[0];
    var pageLang = (document.documentElement.getAttribute('lang') || '').toLowerCase().split('-')[0];
    if (langsAttr.indexOf(pageLang) !== -1) curLang = pageLang;
    try {
      var saved = window.localStorage.getItem('sc-lang');
      if (saved && langsAttr.indexOf(saved) !== -1) curLang = saved;
    } catch (e) { /* storage unavailable — keep page language */ }
  }
  function S() { return LANG_META[curLang].s; }

  var CSS = `
  #sc-btn{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:${COLOR}!important;background-color:${COLOR}!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border:none;cursor:pointer;font-size:24px;z-index:99998;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:1!important;visibility:visible!important}
  #sc-panel{position:fixed;right:20px;bottom:88px;width:340px;max-width:calc(100vw - 40px);height:440px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.2);display:none;flex-direction:column;z-index:99999;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
  #sc-panel.open{display:flex}
  #sc-head{background:${COLOR}!important;background-color:${COLOR}!important;color:#fff!important;padding:12px 14px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;opacity:1!important;visibility:visible!important}
  #sc-head span{flex:1;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important;visibility:visible!important}
  #sc-head button{background:transparent!important;background-color:transparent!important;border:none;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:18px;cursor:pointer;width:32px;height:32px;padding:0;line-height:1;display:flex!important;align-items:center;justify-content:center;opacity:1!important;visibility:visible!important}
  #sc-lang{background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:6px;font-size:12px;padding:3px 4px;max-width:118px;cursor:pointer}
  #sc-lang option{color:#111}
  #sc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px}
  .sc-m{padding:8px 11px;border-radius:12px;max-width:85%;line-height:1.45;white-space:pre-wrap}
  .sc-u{align-self:flex-end;background:${COLOR}!important;background-color:${COLOR}!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
  .sc-a{align-self:flex-start;background:#f1f5f9;color:#111}
  .sc-src{font-size:11px;margin-top:4px}.sc-src a{color:${COLOR}!important}
  #sc-form{display:flex;border-top:1px solid #e5e7eb;background:#fff}
  #sc-in{flex:1;border:none;padding:11px 12px;font-size:13.5px;outline:none;background:#fff!important;color:#111!important;-webkit-text-fill-color:#111!important;opacity:1!important;visibility:visible!important}
  #sc-send{flex:0 0 auto;background:${COLOR}!important;background-color:${COLOR}!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border:none;padding:0 16px;cursor:pointer;font-size:14px;line-height:1;opacity:.55;filter:saturate(.75);visibility:visible!important}
  #sc-send.sc-ready{opacity:1!important;filter:none}
  .sc-typing{color:#888;font-style:italic}`;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'sc-btn'; btn.innerHTML = '&#128172;'; btn.setAttribute('aria-label', 'Chat');
  var panel = document.createElement('div');
  panel.id = 'sc-panel';
  var headHtml = '<div id="sc-head"><span id="sc-title"></span>';
  if (MULTI && langsAttr.length > 1) {
    headHtml += '<select id="sc-lang" aria-label="Language">' + langsAttr.map(function (c) {
      return '<option value="' + c + '">' + LANG_META[c].name + '</option>';
    }).join('') + '</select>';
  }
  headHtml += '<button type="button" id="sc-x" aria-label="Close chat">&times;</button></div>';
  panel.innerHTML = headHtml +
    '<div id="sc-msgs"></div>' +
    '<form id="sc-form"><input id="sc-in" autocomplete="off"/><button type="submit" id="sc-send" aria-label="Send message" aria-disabled="true">&#10148;</button></form>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var msgs = panel.querySelector('#sc-msgs');
  var titleEl = panel.querySelector('#sc-title');
  var input = panel.querySelector('#sc-in');
  var sendBtn = panel.querySelector('#sc-send');
  var langSel = panel.querySelector('#sc-lang');
  var history = [];
  var greetingEl = null;

  function addMsg(text, who, sources) {
    var d = document.createElement('div');
    d.className = 'sc-m ' + (who === 'u' ? 'sc-u' : 'sc-a');
    d.textContent = text;
    if (sources && sources.length) {
      var s = document.createElement('div');
      s.className = 'sc-src';
      s.innerHTML = S().sources + ' ' + sources.map(function (u, i) {
        return '<a href="' + u + '" target="_blank">[' + (i + 1) + ']</a>';
      }).join(' ');
      d.appendChild(s);
    }
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function applyLang() {
    titleEl.textContent = S().title;
    input.setAttribute('placeholder', S().placeholder);
    panel.setAttribute('dir', LANG_META[curLang].dir);
    if (langSel) langSel.value = curLang;
    /* The greeting is only "ours" until the visitor starts chatting;
       after that, past messages stay in the language they were written in. */
    if (greetingEl && history.length === 0) greetingEl.textContent = S().greeting;
  }
  if (langSel) {
    langSel.onchange = function () {
      curLang = langSel.value;
      try { window.localStorage.setItem('sc-lang', curLang); } catch (e) { /* ignore */ }
      applyLang();
    };
  }
  function syncSendState() {
    var ready = !!input.value.trim();
    sendBtn.classList.toggle('sc-ready', ready);
    sendBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }
  input.addEventListener('input', syncSendState);

  greetingEl = addMsg(S().greeting, 'a');
  applyLang();
  syncSendState();

  btn.onclick = function () { panel.classList.toggle('open'); };
  panel.querySelector('#sc-x').onclick = function () { panel.classList.remove('open'); };
  panel.querySelector('#sc-form').onsubmit = function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    syncSendState();
    addMsg(text, 'u');
    history.push({ role: 'user', text: text });
    var typing = addMsg(S().typing, 'a'); typing.classList.add('sc-typing');
    var payload = { site: SITE, message: text, history: history.slice(-6) };
    if (MULTI) payload.lang = curLang;
    fetch(API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); }).then(function (j) {
      typing.remove();
      if (j.answer) {
        addMsg(j.answer, 'a', j.sources);
        history.push({ role: 'assistant', text: j.answer });
      } else {
        addMsg(MULTI ? S().error : (j.error || 'Something went wrong. Please try again.'), 'a');
      }
    }).catch(function () {
      typing.remove();
      addMsg(MULTI ? S().conn : 'Connection error. Please try again.', 'a');
    });
  };
})();

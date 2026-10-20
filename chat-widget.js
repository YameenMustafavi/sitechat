/* SiteChat widget — free AI chatbot. Embed: <script src="WIDGET_URL" data-site="thedesignpk" data-api="API_URL"></script> */
(function () {
  var script = document.currentScript;
  var SITE = script.getAttribute('data-site') || 'default';
  var API = (script.getAttribute('data-api') || '').replace(/\/$/, '');
  if (!API) return;
  var COLOR = script.getAttribute('data-color') || '#fe1f07';

  var CSS = `
  #sc-btn{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:' + COLOR + ';color:#fff;border:none;cursor:pointer;font-size:24px;z-index:99998;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  #sc-panel{position:fixed;right:20px;bottom:88px;width:340px;max-width:calc(100vw - 40px);height:440px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.2);display:none;flex-direction:column;z-index:99999;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
  #sc-panel.open{display:flex}
  #sc-head{background:' + COLOR + ';color:#fff;padding:12px 14px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center}
  #sc-head button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer}
  #sc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px}
  .sc-m{padding:8px 11px;border-radius:12px;max-width:85%;line-height:1.45;white-space:pre-wrap}
  .sc-u{align-self:flex-end;background:' + COLOR + ';color:#fff}
  .sc-a{align-self:flex-start;background:#f1f5f9;color:#111}
  .sc-src{font-size:11px;margin-top:4px}.sc-src a{color:' + COLOR + '}
  #sc-form{display:flex;border-top:1px solid #e5e7eb}
  #sc-in{flex:1;border:none;padding:11px 12px;font-size:13.5px;outline:none}
  #sc-form button{background:' + COLOR + ';color:#fff;border:none;padding:0 16px;cursor:pointer;font-size:14px}
  .sc-typing{color:#888;font-style:italic}`;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'sc-btn'; btn.innerHTML = '&#128172;'; btn.setAttribute('aria-label', 'Chat');
  var panel = document.createElement('div');
  panel.id = 'sc-panel';
  panel.innerHTML = '<div id="sc-head"><span>Ask us anything</span><button id="sc-x">&times;</button></div>' +
    '<div id="sc-msgs"></div>' +
    '<form id="sc-form"><input id="sc-in" placeholder="Type your question..." autocomplete="off"/><button type="submit">&#10148;</button></form>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var msgs = panel.querySelector('#sc-msgs');
  var history = [];
  function addMsg(text, who, sources) {
    var d = document.createElement('div');
    d.className = 'sc-m ' + (who === 'u' ? 'sc-u' : 'sc-a');
    d.textContent = text;
    if (sources && sources.length) {
      var s = document.createElement('div');
      s.className = 'sc-src';
      s.innerHTML = 'Sources: ' + sources.map(function (u, i) {
        return '<a href="' + u + '" target="_blank">[' + (i + 1) + ']</a>';
      }).join(' ');
      d.appendChild(s);
    }
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  addMsg('Hi! Ask me anything about this site — services, pricing, contact info.', 'a');

  btn.onclick = function () { panel.classList.toggle('open'); };
  panel.querySelector('#sc-x').onclick = function () { panel.classList.remove('open'); };
  panel.querySelector('#sc-form').onsubmit = function (e) {
    e.preventDefault();
    var input = panel.querySelector('#sc-in');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'u');
    history.push({ role: 'user', text: text });
    var typing = addMsg('Typing...', 'a'); typing.classList.add('sc-typing');
    fetch(API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: SITE, message: text, history: history.slice(-6) }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      typing.remove();
      if (j.answer) {
        addMsg(j.answer, 'a', j.sources);
        history.push({ role: 'assistant', text: j.answer });
      } else {
        addMsg(j.error || 'Something went wrong. Please try again.', 'a');
      }
    }).catch(function () {
      typing.remove();
      addMsg('Connection error. Please try again.', 'a');
    });
  };
})();

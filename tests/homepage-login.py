from pathlib import Path
from playwright.sync_api import sync_playwright
s=Path('app/src/main/assets/classroom.js').read_text()
login=s[s.index('const loginPanels'):s.index('async function loginAction')]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
 for width,height in [(1280,800),(800,1280)]:
  pg=b.new_page(viewport=dict(width=width,height=height),has_touch=True)
  pg.set_content('<style>body>*{visibility:hidden!important} header{transform:translateX(8px);overflow:hidden;height:50px}</style><header><button class="header-login-entry">登录</button></header><div id="feed">推荐</div>')
  pg.evaluate("""()=>{window.hits=0;document.querySelector('header').addEventListener('click',e=>{if(!e.isTrusted)return;hits++;const panel=document.createElement('div');panel.className='bili-mini-mask';panel.innerHTML='<input type="tel" placeholder="手机号"><div class="geetest_panel">验证码</div>';document.body.append(panel);});}""")
  pg.add_script_tag(content="let loginOpen=false,loginPoll;const checkLogin=async()=>'guest';"+login+";openHomepageLogin()")
  el=pg.locator('[data-lemon-entry]');r=el.bounding_box()
  assert abs(r['x']+r['width']/2-width/2)<2 and abs(r['y']+r['height']/2-height/2)<2 and r['width']>=180 and r['height']>=56
  assert pg.evaluate('hits')==0 and not pg.locator('#feed').is_visible()
  pg.touchscreen.tap(width//2,height//2);pg.wait_for_timeout(350)
  assert pg.evaluate('hits')==1 and pg.locator('input').is_visible() and pg.locator('.geetest_panel').is_visible() and not el.count()
  pg.locator('input').tap();assert pg.locator('input').evaluate('el=>el===document.activeElement')
  print(width,height,r,'PASS');pg.close()

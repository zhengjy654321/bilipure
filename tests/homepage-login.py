from pathlib import Path
from playwright.sync_api import sync_playwright

source = Path('app/src/main/assets/classroom.js').read_text()
login = source[source.index('function openHomepageLogin'):source.index('async function loginAction')]
styles = source[source.index('function applyStyle'):source.index('function viewport')]
fixture = """
<style>header{display:flex;gap:10px}.left-entry{width:30%}.center-search-container{width:25%}</style>
<header class="bili-header__bar"><nav class="left-entry"><a>番剧</a></nav>
<div class="center-search-container"><input></div><button id="login">登录</button>
<a class="right-entry__outside">历史</a></header>
<div class="bili-header__banner">横幅</div><main class="bili-layout">推荐</main><div id="orange-classroom"></div>
"""
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for width, height in [(1280,800),(800,1280)]:
        page = browser.new_page(viewport=dict(width=width,height=height), has_touch=True)
        page.goto('about:blank')
        page.set_content(fixture)
        button = page.locator('#login')
        initial = button.bounding_box()
        page.evaluate("""()=>document.querySelector('#login').onclick=e=>{
          if(!e.isTrusted)return;
          const box=document.createElement('section');
          box.innerHTML='<input type="tel"><button id="challenge">验证</button>';
          document.body.append(box);
          box.querySelector('button').onclick=()=>document.body.append(document.createElement('iframe'));
        }""")
        page.add_script_tag(content="let official=false,home=true,loginOpen=false,loginPoll;const pageStyle=document.createElement('style');document.head.append(pageStyle);const checkLogin=async()=>'guest';"+styles+login+";applyStyle();openHomepageLogin();")
        assert button.bounding_box()==initial and button.is_visible()
        for selector in ['.left-entry a','.center-search-container input','.right-entry__outside','.bili-header__banner','.bili-layout','#orange-classroom']:
            assert not page.locator(selector).is_visible(), selector
        button.tap()
        phone=page.locator('input[type=tel]')
        phone.tap()
        assert phone.evaluate('el=>el===document.activeElement')
        page.locator('#challenge').tap()
        assert page.locator('iframe').is_visible()
        assert page.get_by_text('返回课堂').is_visible()
        page.close()

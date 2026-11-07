"""Builds the CPR guide videos (student + admin): Thai narration (edge-tts), burned-in subtitles, 1080x1920."""
import json, os, re, subprocess, sys, time
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
W, H = 1080, 1920
BG = (22, 61, 58)          # #163D3A — same as teacher-guide poster
ACCENT = (230, 204, 122)
VOICE = 'th-TH-NiwatNeural'
ENV = dict(os.environ, SSL_CERT_FILE='/root/.ccr/ca-bundle.crt')

# Words the Thai voice reads better spelled in Thai (subtitles keep the original)
SAY = [
    ('firstaid.morroo.com/cpr/guide', 'เฟิร์สเอด ดอท มอรู ดอท คอม สแลช ซีพีอาร์ สแลช ไกด์'),
    ('firstaid.morroo.com/cpr', 'เฟิร์สเอด ดอท มอรู ดอท คอม สแลช ซีพีอาร์'),
    ('cpr.morroo.com', 'ซีพีอาร์ ดอท มอรู ดอท คอม'),
    ('@jiacpr', 'แอท เจียซีพีอาร์'),
    ('CPR & AED', 'ซีพีอาร์ และ เออีดี'), ('CPR + ปฐมพยาบาล', 'ซีพีอาร์ และปฐมพยาบาล'),
    ('CPR', 'ซีพีอาร์'), ('AED', 'เออีดี'), ('Post-test', 'โพสต์เทสต์'), ('LINE', 'ไลน์'),
    ('QR', 'คิวอาร์'), ('PDF', 'พีดีเอฟ'), ('HR', 'เอชอาร์'), ('JIA', 'เจีย'), ('FirstAid', 'เฟิร์สเอด'),
    ('80%', 'แปดสิบเปอร์เซ็นต์'), ('—', ' '), ("'", ''), ('"', ''), ('-', ' '),
]

def say_text(t):
    for a, b in SAY:
        t = t.replace(a, b)
    return t

def tts(text, out, rate='+8%'):
    for attempt in range(6):
        r = subprocess.run(['edge-tts', '--proxy', os.environ['HTTPS_PROXY'], '--voice', VOICE, f'--rate={rate}',
                            '--text', text, '--write-media', out], env=ENV, capture_output=True, text=True)
        if r.returncode == 0 and os.path.getsize(out) > 1000:
            return
        time.sleep(2 + attempt)
    raise RuntimeError('tts failed: ' + text[:40] + ' ' + r.stderr[-300:])

def duration(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())

def frame(shot, out):
    img = Image.new('RGB', (W, H), BG)
    if shot:
        s = Image.open(os.path.join(SHOTS, shot + '.png')).convert('RGB')
        top, bottom = 250, 1540                      # title band above, subtitle band below
        h = bottom - top; w = int(s.width * h / s.height)
        s = s.resize((w, h), Image.LANCZOS)
        x = (W - w) // 2
        # shadow + rounded "phone" card
        sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle((x + 6, top + 14, x + w + 6, bottom + 14), 36, fill=140)
        img.paste((0, 0, 0), mask=sh.filter(ImageFilter.GaussianBlur(18)))
        ImageDraw.Draw(img).rounded_rectangle((x - 10, top - 10, x + w + 10, bottom + 10), 40, fill=(255, 255, 255))
        m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w, h), 30, fill=255)
        img.paste(s, (x, top), m)
    img.save(out)

def ass_time(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def esc(t):
    return t.replace('{', '(').replace('}', ')').replace('\n', '\\N')

ASS_HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Noto Sans Thai,62,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,8,60,60,90,1
Style: Step,Noto Sans Thai,40,&H007ACCE6,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,2,0,1,0,0,8,60,60,40,1
Style: Sub,Noto Sans Thai,50,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,3,16,0,2,60,60,110,1
Style: Big,Noto Sans Thai,92,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1
Style: BigSub,Noto Sans Thai,50,&H007ACCE6,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def build(name, scenes, workdir):
    os.makedirs(workdir, exist_ok=True)
    segs = []
    srt = []
    t0 = 0.0
    for i, sc in enumerate(scenes):
        lines = sc['lines']
        audio = os.path.join(workdir, f'{i:02d}.mp3')
        if not os.path.exists(audio) or os.path.getsize(audio) < 1000:
            tts(' '.join(say_text(l) for l in lines), audio)
        ad = duration(audio)
        pad_in, pad_out = 0.35, 0.6
        dur = ad + pad_in + pad_out
        png = os.path.join(workdir, f'{i:02d}.png')
        frame(sc.get('shot'), png)
        # subtitles: split the audio time by each line's share of characters
        total = sum(len(l) for l in lines)
        ev = []
        t = pad_in
        for l in lines:
            d = ad * len(l) / total
            ev.append((t, t + d, l)); t += d
        ass = ASS_HEAD
        if sc.get('shot'):
            ass += f"Dialogue: 0,{ass_time(0)},{ass_time(dur)},Step,,0,0,0,,{esc(sc.get('step', ''))}\n"
            ass += f"Dialogue: 0,{ass_time(0)},{ass_time(dur)},Title,,0,0,0,,{esc(sc['title'])}\n"
            for a, b, l in ev:
                ass += f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Sub,,0,0,0,,{esc(l)}\n"
        else:  # title card
            ass += f"Dialogue: 0,{ass_time(0)},{ass_time(dur)},Big,,0,0,0,,{{\\pos(540,820)}}{esc(sc['title'])}\n"
            ass += f"Dialogue: 0,{ass_time(0)},{ass_time(dur)},BigSub,,0,0,0,,{{\\pos(540,1060)}}{esc(sc.get('subtitle', ''))}\n"
            for a, b, l in ev:
                ass += f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Sub,,0,0,0,,{esc(l)}\n"
        assf = os.path.join(workdir, f'{i:02d}.ass')
        open(assf, 'w').write(ass)
        for a, b, l in ev:
            srt.append((t0 + a, t0 + b, l))
        seg = os.path.join(workdir, f'{i:02d}.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', png,
                        '-i', audio, '-filter_complex',
                        f"[0:v]ass={assf},fade=t=in:st=0:d=0.25,fade=t=out:st={dur-0.25:.2f}:d=0.25,format=yuv420p[v];"
                        f"[1:a]adelay={int(pad_in*1000)}|{int(pad_in*1000)},apad,atrim=0:{dur:.3f},aresample=44100[a]",
                        '-map', '[v]', '-map', '[a]', '-t', f'{dur:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
                        '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ac', '1', seg], check=True)
        segs.append(seg)
        t0 += dur
        print(f'{name} scene {i} {dur:.1f}s', flush=True)
    lst = os.path.join(workdir, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{s}'\n" for s in segs))
    out = os.path.join(HERE, f'{name}.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out], check=True)
    # WebVTT captions (also burned in) for accessibility / players
    def vt(t):
        return f'{int(t//3600):02d}:{int(t%3600//60):02d}:{t%60:06.3f}'
    with open(os.path.join(HERE, f'{name}.vtt'), 'w') as f:
        f.write('WEBVTT\n\n')
        for a, b, l in srt:
            f.write(f'{vt(a)} --> {vt(b)}\n{l}\n\n')
    # poster from the second scene
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '1.5', '-i', segs[0], '-frames:v', '1', '-vf', 'scale=540:-1', '-q:v', '4',
                    os.path.join(HERE, f'{name}.jpg')], check=True)
    print(name, 'total', round(t0, 1), 's')

if __name__ == '__main__':
    which = sys.argv[1]
    scenes = json.load(open(os.path.join(HERE, f'{which}.json')))
    build(which, scenes, os.path.join(HERE, 'work-' + which))

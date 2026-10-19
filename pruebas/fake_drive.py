import json, re, itertools, urllib.parse
class FakeDrive:
    def __init__(self):
        self.files={}; self.n=itertools.count(1); self.log=[]
    def nuevo(self, name, parents, mime, content=b''):
        fid=f'f{next(self.n)}'
        self.files[fid]={'id':fid,'name':name,'parents':list(parents),'mimeType':mime,'trashed':False,'content':content,'modifiedTime':f't{next(self.n)}'}
        return self.files[fid]
    def ruta(self, fid):
        f=self.files[fid]; partes=[f['name']]
        while f['parents'] and f['parents'][0] in self.files:
            f=self.files[f['parents'][0]]; partes.insert(0,f['name'])
        return '/'.join(partes)
    def vivos(self): return [f for f in self.files.values() if not f['trashed']]
    def multipart(self, body, ctype):
        b=re.search(r'boundary=(\S+)', ctype).group(1)
        partes=body.split(('--'+b).encode())
        meta=json.loads(partes[1].split(b'\r\n\r\n',1)[1].strip())
        cont=partes[2].split(b'\r\n\r\n',1)[1]
        if cont.endswith(b'\r\n'): cont=cont[:-2]
        return meta, cont
    def handle(self, route, req):
        u=urllib.parse.urlparse(req.url); q=urllib.parse.parse_qs(u.query); path=u.path; m=req.method
        self.log.append((m,path))
        def ok(obj): route.fulfill(status=200, content_type='application/json', body=json.dumps(obj))
        def pub(f): return {k:v for k,v in f.items() if k!='content'}
        if path.endswith('/about'): return ok({'user':{'emailAddress':'yo@test.com'}})
        if path=='/drive/v3/files' and m=='GET':
            qq=q.get('q',[''])[0]
            name=re.search(r"name = '((?:[^'\\]|\\.)*)'", qq); par=re.search(r"'([^']+)' in parents", qq)
            res=[f for f in self.vivos() if (not par or par.group(1) in f['parents'] or (par.group(1)=='root' and not f['parents'])) and (not name or f['name']==name.group(1).replace("\\'","'")) and ('folder' not in qq or f['mimeType'].endswith('folder'))]
            return ok({'files':[pub(f) for f in res]})
        if path=='/drive/v3/files' and m=='POST':
            meta=json.loads(req.post_data or '{}'); f=self.nuevo(meta['name'], [p for p in meta.get('parents',[]) if p!='root'], meta.get('mimeType',''))
            return ok(pub(f))
        mm=re.match(r'/drive/v3/files/([^/]+)/copy$', path)
        if mm and m=='POST':
            src=self.files.get(mm.group(1))
            if not src or src['trashed']: return route.fulfill(status=404, body='{}')
            meta=json.loads(req.post_data); f=self.nuevo(meta['name'], meta['parents'], src['mimeType'], src['content']); return ok(pub(f))
        mm=re.match(r'/drive/v3/files/([^/]+)$', path)
        if mm:
            f=self.files.get(urllib.parse.unquote(mm.group(1)))
            if not f: return route.fulfill(status=404, content_type='application/json', body='{"error":{"message":"no"}}')
            if m=='GET':
                if q.get('alt')==['media']: return route.fulfill(status=200, body=f['content'])
                return ok(pub(f))
            if m=='PATCH':
                body=json.loads(req.post_data or '{}')
                if 'name' in body: f['name']=body['name']
                if body.get('trashed'): f['trashed']=True
                if 'addParents' in q: f['parents']=[p for p in f['parents'] if p not in q.get('removeParents',[''])[0].split(',')]+[q['addParents'][0]]
                f['modifiedTime']=f't{next(self.n)}'
                return ok(pub(f))
        if path=='/upload/drive/v3/files' and m=='POST':
            meta,cont=self.multipart(req.post_data_buffer, req.headers['content-type'])
            f=self.nuevo(meta['name'], meta.get('parents',[]), meta.get('mimeType','application/octet-stream'), cont); return ok(pub(f))
        mm=re.match(r'/upload/drive/v3/files/([^/]+)$', path)
        if mm and m=='PATCH':
            f=self.files[urllib.parse.unquote(mm.group(1))]; f['content']=req.post_data_buffer; f['modifiedTime']=f't{next(self.n)}'; return ok(pub(f))
        print('NO MANEJADO', m, req.url); route.fulfill(status=500, body='{}')

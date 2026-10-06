import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module';

interface InitUploadBody {
  signedUrl: string;
  blobName: string;
}

interface DocumentBody {
  id: string;
  status: string;
  chunkCount: number;
}

interface PaginatedBody {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
}

interface SearchBody {
  total: number;
  results: Array<{
    documentId: string;
    filename: string;
    score: number;
    text: string;
  }>;
}

describe('Documents & RAG (e2e)', () => {
  let app: INestApplication;
  const agentId = randomUUID();
  const userId = 'e2e-user';
  const threadId = randomUUID();
  const messageId = randomUUID();
  const fileContent = Buffer.from(
    'Autoralidade é a capacidade de criar conteúdo original com autoridade própria. ' +
      'Um palestrante com autoralidade transmite credibilidade e profundidade no tema.',
  );
  let blobName: string;
  let documentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (documentId) {
      await request(app.getHttpServer()).delete(`/documents/${documentId}`);
    }
    await app.close();
  });

  describe('validações', () => {
    it('POST /documents/upload/init rejeita type inválido', () => {
      return request(app.getHttpServer())
        .post('/documents/upload/init')
        .send({
          originalName: 'x.txt',
          mimeType: 'text/plain',
          size: 10,
          agentId,
          type: 'invalido',
        })
        .expect(400);
    });

    it('POST /documents/upload/init rejeita type user sem userId/threadId/messageId', () => {
      return request(app.getHttpServer())
        .post('/documents/upload/init')
        .send({
          originalName: 'x.txt',
          mimeType: 'text/plain',
          size: 10,
          agentId,
          type: 'user',
        })
        .expect(400);
    });

    it('POST /rag/search rejeita query vazia', () => {
      return request(app.getHttpServer())
        .post('/rag/search')
        .send({ query: '', agentId })
        .expect(400);
    });

    it('POST /rag/search rejeita limit acima de 50', () => {
      return request(app.getHttpServer())
        .post('/rag/search')
        .send({ query: 'teste', agentId, limit: 100 })
        .expect(400);
    });

    it('GET /documents/:id retorna 404 para documento inexistente', () => {
      return request(app.getHttpServer())
        .get(`/documents/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('listagem', () => {
    it('GET /documents retorna lista paginada', () => {
      return request(app.getHttpServer())
        .get('/documents')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          const body = res.body as PaginatedBody;
          expect(body).toHaveProperty('items');
          expect(body).toHaveProperty('total');
          expect(body.page).toBe(1);
          expect(body.limit).toBe(10);
        });
    });

    it('GET /documents aceita filtro por status', () => {
      return request(app.getHttpServer())
        .get('/documents')
        .query({ status: 'processed' })
        .expect(200);
    });

    it('GET /documents rejeita status inválido', () => {
      return request(app.getHttpServer())
        .get('/documents')
        .query({ status: 'inexistente' })
        .expect(400);
    });
  });

  describe('fluxo completo: init → blob → confirm → status → search → delete', () => {
    it('1. init upload retorna signed URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/upload/init')
        .send({
          originalName: 'e2e-autoralidade.txt',
          mimeType: 'text/plain',
          size: fileContent.length,
          agentId,
          type: 'user',
          userId,
          threadId,
          messageId,
        })
        .expect(201);

      const body = res.body as InitUploadBody;
      expect(body.signedUrl).toBeDefined();
      expect(body.blobName).toContain('e2e-autoralidade.txt');
      blobName = body.blobName;

      const put = await fetch(body.signedUrl, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      });
      expect(put.ok).toBe(true);
    }, 30000);

    it('2. confirm cria documento com status uploaded', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/upload/confirm')
        .send({
          blobName,
          originalName: 'e2e-autoralidade.txt',
          mimeType: 'text/plain',
          size: String(fileContent.length),
          agentId,
          type: 'user',
          userId,
          threadId,
          messageId,
        })
        .expect(201);

      const body = res.body as DocumentBody;
      expect(body.id).toBeDefined();
      expect(body.status).toBe('uploaded');
      documentId = body.id;
    }, 30000);

    it('3. status chega a processed via polling', async () => {
      const deadline = Date.now() + 170000;
      let status = '';
      while (Date.now() < deadline) {
        const res = await request(app.getHttpServer())
          .get(`/documents/${documentId}/status`)
          .expect(200);
        status = (res.body as DocumentBody).status;
        if (status === 'processed' || status === 'failed') break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      expect(status).toBe('processed');
    }, 180000);

    it('4. documento processado tem chunks', async () => {
      const res = await request(app.getHttpServer())
        .get(`/documents/${documentId}`)
        .expect(200);

      const body = res.body as DocumentBody;
      expect(body.status).toBe('processed');
      expect(body.chunkCount).toBeGreaterThan(0);
    });

    it('5. busca semântica retorna o conteúdo indexado', async () => {
      const res = await request(app.getHttpServer())
        .post('/rag/search')
        .send({ query: 'o que é autoralidade?', agentId, limit: 3 })
        .expect(200);

      const body = res.body as SearchBody;
      expect(body.total).toBeGreaterThan(0);
      expect(body.results[0]).toMatchObject({
        documentId,
        filename: 'e2e-autoralidade.txt',
      });
      expect(body.results[0].score).toBeGreaterThan(0);
      expect(body.results[0].text).toContain('Autoralidade');
    }, 30000);

    it('6. delete remove documento e artefatos', async () => {
      await request(app.getHttpServer())
        .delete(`/documents/${documentId}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/documents/${documentId}`)
        .expect(404);

      const search = await request(app.getHttpServer())
        .post('/rag/search')
        .send({ query: 'autoralidade', agentId, limit: 3 })
        .expect(200);
      expect((search.body as SearchBody).total).toBe(0);

      documentId = '';
    }, 30000);
  });
});

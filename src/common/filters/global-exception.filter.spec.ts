import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  const send = jest.fn();
  const status = jest.fn(() => ({ send }));
  const response = { status };
  const request = { url: '/documents' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new GlobalExceptionFilter();
  });

  const sentBody = () =>
    (send.mock.calls[0] as unknown[])[0] as Record<string, unknown>;

  it('trata HttpException com mensagem string', () => {
    filter.catch(new BadRequestException('payload inválido'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(sentBody()).toMatchObject({
      message: 'payload inválido',
      statusCode: 400,
      errorCode: 'DEFAULT_ERROR',
      path: '/documents',
    });
  });

  it('junta array de mensagens de validação', () => {
    filter.catch(
      new BadRequestException(['campo a obrigatório', 'campo b inválido']),
      host,
    );

    expect(sentBody().message).toBe('campo a obrigatório, campo b inválido');
  });

  it('trata Error genérico como 500 com mensagem padrão', () => {
    filter.catch(new Error('boom interno'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sentBody()).toMatchObject({
      message: 'Serviço indisponível. Tente novamente mais tarde.',
      statusCode: 500,
    });
  });

  it('usa errorCode do response quando presente', () => {
    const exception = new Error('falha') as Error & {
      response: { data: { errorCode: string } };
    };
    exception.response = { data: { errorCode: 'CUSTOM_ERR' } };

    filter.catch(exception, host);

    expect(sentBody().errorCode).toBe('CUSTOM_ERR');
  });

  it('trata exceção não-Error com resposta genérica', () => {
    filter.catch('string qualquer', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sentBody()).toMatchObject({
      message: 'Erro não tratado',
      path: '/documents',
    });
  });

  it('usa error_description quando message ausente', () => {
    const exception = new BadRequestException({
      error: 'invalid_request',
      error_description: 'descrição detalhada',
    });

    filter.catch(exception, host);

    expect(sentBody().message).toBe('descrição detalhada');
  });

  it('retorna string vazia quando payload sem message e sem error', () => {
    const exception = new BadRequestException({});

    filter.catch(exception, host);

    expect(sentBody().message).toBe('');
  });

  it('trata HttpException com getResponse retornando string direta', () => {
    const exception = new HttpException('mensagem direta', 403);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(sentBody().message).toBe('mensagem direta');
  });

  it('usa exception.message quando data é falsy', () => {
    const exception = new Error('mensagem original') as Error & {
      getStatus: () => number;
      getResponse: () => unknown;
    };
    Object.setPrototypeOf(exception, HttpException.prototype);
    exception.getStatus = () => 500;
    exception.getResponse = () => null;

    filter.catch(exception, host);

    expect(sentBody().message).toBe('mensagem original');
  });

  it('retorna string vazia quando só error presente sem error_description', () => {
    const exception = new BadRequestException({ error: 'invalid_request' });

    filter.catch(exception, host);

    expect(sentBody().message).toBe('');
  });

  it('retorna message string simples do payload', () => {
    const exception = new BadRequestException({ message: 'só uma string' });

    filter.catch(exception, host);

    expect(sentBody().message).toBe('só uma string');
  });
});

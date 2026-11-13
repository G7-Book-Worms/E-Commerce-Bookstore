import { NextResponse } from 'next/server';
import { HttpStatus, HttpStatusCode } from './status-codes';

export interface ApiResponsePayload<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export class HttpResponse {
  static success<T>(data: T, message: string = 'Success', status: number = HttpStatus.OK) {
    return NextResponse.json<ApiResponsePayload<T>>({ success: true, message, data }, { status });
  }

  static created<T>(data: T, message: string = 'Resource created') {
    return NextResponse.json<ApiResponsePayload<T>>({ success: true, message, data }, { status: HttpStatus.CREATED });
  }

  static error(message: string, status: number = HttpStatus.INTERNAL_SERVER_ERROR) {
    return NextResponse.json<ApiResponsePayload>({ success: false, error: message }, { status });
  }

  static badRequest(message: string = 'Bad Request') {
    return HttpResponse.error(message, HttpStatus.BAD_REQUEST);
  }

  static internalError(message: string = 'Internal Server Error') {
    return HttpResponse.error(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
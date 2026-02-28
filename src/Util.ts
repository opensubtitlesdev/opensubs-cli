import {readJsonSync} from "fs-extra";
import {join} from "path"
import * as https from "https"
import {createUnzip} from "zlib"
import {pipeline,Readable} from "stream"
import {promisify} from "util";
import {createWriteStream} from "fs";
import {ILanguage, IApiLanguage, IUserInfo} from "./Types";
import {IncomingHttpHeaders} from "http";

const pipe=promisify(pipeline);

export function isString(...str:string[]):boolean{
	for(let s of str){
		if(typeof s !== "string" || s.length<1){
			return false;
		}
	}
	return true;
}

export function getLang(lang:string):ILanguage{
	const json=readJsonSync(join(__dirname,"../langs.json"));
	const languages:IApiLanguage[]=Array.isArray(json) ? json : (json.data || []);

	const found=languages.find(l=>l.language_code===lang);
	if(!found) return null;
	return { alpha2: found.language_code, alpha3: found.language_code, name: found.language_name };
}

export async function fetchApiLanguages(): Promise<IApiLanguage[]> {
	return new Promise((resolve, reject) => {
		const {getApiKey} = require('./Config');
		const options = {
			hostname: 'api.opensubtitles.com',
			path: '/api/v1/infos/languages',
			headers: {
				'Api-Key': getApiKey(),
				'Content-Type': 'application/json',
				'User-Agent': 'opensubs-cli v' + require('../package.json').version
			}
		};
		https.get(options, (res: any) => {
			let data = '';
			res.on('data', (chunk: string) => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve(json.data || []);
				} catch (e) {
					reject(new Error('Failed to parse language list from API'));
				}
			});
		}).on('error', reject);
	});
}

export async function fetchUserInfo(token?: string | null): Promise<IUserInfo> {
	return new Promise((resolve, reject) => {
		const {getApiKey} = require('./Config');
		const headers: Record<string, string> = {
			'Api-Key': getApiKey(),
			'Content-Type': 'application/json',
			'User-Agent': 'opensubs-cli v' + require('../package.json').version
		};
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
		const options = {
			hostname: 'api.opensubtitles.com',
			path: '/api/v1/infos/user',
			headers
		};
		https.get(options, (res: any) => {
			let data = '';
			res.on('data', (chunk: string) => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve(json.data || json);
				} catch (e) {
					reject(new Error('Failed to parse user info from API'));
				}
			});
		}).on('error', reject);
	});
}

export async function downloadFile(url:string,path:string,unzip:boolean=true):Promise<IncomingHttpHeaders>{
	return new Promise<IncomingHttpHeaders>((resolve,reject)=>{
		// Parse URL properly to handle redirects and different domains
		const parsedUrl = new URL(url);
		const protocol = parsedUrl.protocol === 'https:' ? https : require('http');

		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.pathname + parsedUrl.search,
			headers: {
				"User-Agent": "TemporaryUserAgent"
			}
		};

		protocol.get(options, (res: any) => {
			// Handle redirects
			if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
				const redirectUrl = res.headers.location;
				if (redirectUrl) {
					// Resolve relative URLs
					const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
					return downloadFile(absoluteUrl, path, unzip).then(resolve).catch(reject);
				}
			}

			if(res.statusCode===200){
				let writeFile:Promise<any>;

				let fStream=createWriteStream(path);
				if(unzip){
					writeFile=pipe(res,createUnzip(),fStream);
				} else {
					writeFile=pipe(res,fStream);
				}

				writeFile
					.then(()=>resolve(res.headers))
					.catch(e=>reject(new Error(e.message)));
			}else{
				reject(new Error(`${res.statusCode} ${res.statusMessage}`));
			}
		}).on('error', (err: any) => {
			reject(err);
		});
	});
}
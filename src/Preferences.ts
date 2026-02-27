import {getDataHome} from "platform-folders"
import {ensureFile,readJson,writeJsonSync,readFileSync,writeFileSync,pathExistsSync} from "fs-extra"
import {join} from "path";

export const PREF_DIR=join(getDataHome(),"Subtitles CLI");
export const PREF_FILE=join(PREF_DIR,"preferences.json");
const TOKEN_FILE=join(PREF_DIR,"token.txt");

interface IPreferences {
	lang:string;
	account:string;
	useragent?:string;
	anonymousDownloadCount?:number;
}

class Preferences{
	private _lang:string;
	private _account:string;
	private _useragent:string;
	private _anonymousDownloadCount:number;

	public async loadPreferences(){
		await ensureFile(PREF_FILE);

		try{
			const pref:IPreferences=await readJson(PREF_FILE);
			this._lang=pref.lang;
			this._account=pref.account;
			this._useragent=pref.useragent;
			this._anonymousDownloadCount=pref.anonymousDownloadCount || 0;
		}catch (e) {
			this._anonymousDownloadCount=0;
			this.writeFile();
		}
	}

	public writeFile(){
		writeJsonSync(PREF_FILE,{
			lang:this._lang,
			account:this._account,
			useragent:this._useragent,
			anonymousDownloadCount:this._anonymousDownloadCount
		});
	}

	get lang():string{
		return this._lang;
	}

	get account():string{
		return this._account;
	}

	get useragent():string{
		return this._account;
	}

	set lang(value:string){
		this._lang=value;
		this.writeFile();
	}

	set account(value:string){
		this._account=value;
		this.writeFile();
	}

	set useragent(value:string){
		this._useragent=value;
		this.writeFile();
	}

	get anonymousDownloadCount():number{
		return this._anonymousDownloadCount || 0;
	}

	set anonymousDownloadCount(value:number){
		this._anonymousDownloadCount = value;
		this.writeFile();
	}

	public incrementAnonymousDownloadCount(){
		this._anonymousDownloadCount = (this._anonymousDownloadCount || 0) + 1;
		this.writeFile();
	}

	public resetAnonymousDownloadCount(){
		this._anonymousDownloadCount = 0;
		this.writeFile();
	}

	// Token management
	public saveToken(token:string){
		writeFileSync(TOKEN_FILE, token, {encoding: 'utf8'});
	}

	public getToken():string|null{
		if(!pathExistsSync(TOKEN_FILE)){
			return null;
		}
		try{
			return readFileSync(TOKEN_FILE, {encoding: 'utf8'});
		}catch(e){
			return null;
		}
	}

	public clearToken(){
		if(pathExistsSync(TOKEN_FILE)){
			const fs = require('fs');
			fs.unlinkSync(TOKEN_FILE);
		}
	}

	public isTokenExpired(token:string):boolean{
		try{
			// JWT has 3 parts separated by dots: header.payload.signature
			const parts = token.split('.');
			if(parts.length !== 3){
				return true;
			}

			// Decode the payload (second part)
			const payload = Buffer.from(parts[1], 'base64').toString('utf8');
			const data = JSON.parse(payload);

			// Check expiry (exp is in seconds since epoch)
			if(data.exp){
				const expiryTime = data.exp * 1000; // Convert to milliseconds
				const now = Date.now();
				return now >= expiryTime;
			}

			// If no expiry, consider it expired
			return true;
		}catch(e){
			// If we can't parse it, consider it expired
			return true;
		}
	}
}

export default new Preferences();
/**
 * (C) 2018 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */
import {i18n} from "/framework/js/i18n.mjs";
import {session} from "/framework/js/session.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";

const HS = "?.=";

async function loadPage(url, dataModels={}) {
	const urlParsed = new URL(url, window.location.href), baseURL = urlParsed.origin + urlParsed.pathname; url = urlParsed.href;	// normalize

	if (!session.get("__org_monkshu_router_history")) session.set("__org_monkshu_router_history", {});
	const history = session.get("__org_monkshu_router_history"); let hash;

	if (url.indexOf(HS) == -1) {
		hash = btoa(url);
		window.history.pushState(null, null, new URL(window.location.href).pathname+HS+hash);
		history[hash] = [url, dataModels];
	} else {
		hash = url.substring(url.indexOf(HS)+HS.length);
		url = new URL(atob(hash), window.location).href;
		if (!history[hash]) history[hash] = [url,"en",{}];
	}

	session.set($$.MONKSHU_CONSTANTS.PAGE_URL, url);
	session.set($$.MONKSHU_CONSTANTS.PAGE_DATA, dataModels);
	
	const html = await loadHTML(url, dataModels);
	document.open("text/html");
	document.write(html);
	document.close();

	// notify those who want to know that a new page was loaded
	if (window.monkshu_env.pageload_funcs[url]) for (const func of window.monkshu_env.pageload_funcs[url]) await func(dataModels, url);
	if (window.monkshu_env.pageload_funcs[baseURL]) for (const func of window.monkshu_env.pageload_funcs[baseURL]) await func(dataModels, url);
	if (window.monkshu_env.pageload_funcs["*"]) for (const func of window.monkshu_env.pageload_funcs["*"]) await func(dataModels, url);
}

async function loadHTML(url, dataModels, checkSecurity = true) {
	const urlParsed = new URL(url); url = urlParsed.origin + urlParsed.pathname; 	// Parse
	if (checkSecurity && !securityguard.isAllowed(url)) throw new Error("Not allowed: Security Exception");	// security block

	try {
		let [html, _] = await Promise.all([
			fetch(url, {mode: "no-cors", cache: "default"}).then(response => response.text()), 
			$$.require("/framework/3p/mustache.min.js")]);

		dataModels = await getPageData(urlParsed.href, dataModels);
		if (window.monkshu_env.pagedata_funcs[urlParsed.href]) for (const func of window.monkshu_env.pagedata_funcs[urlParsed.href]) await func(dataModels, url);
		if (window.monkshu_env.pagedata_funcs[url]) for (const func of window.monkshu_env.pagedata_funcs[url]) await func(dataModels, url);
		if (window.monkshu_env.pagedata_funcs["*"]) for (const func of window.monkshu_env.pagedata_funcs["*"]) await func(dataModels, url);

		Mustache.parse(html);
		html = Mustache.render(html, dataModels);

		return html;
	} catch (err) {throw err}
} 

async function expandPageData(text, url, dataModels) {
	dataModels = await getPageData(url, dataModels);

	Mustache.parse(text);
	const rendered = Mustache.render(text,dataModels);

	return rendered;
}

async function getPageData(url, dataModels) {
	const i18nObj = await i18n.getI18NObject(session.get($$.MONKSHU_CONSTANTS.LANG_ID));
	dataModels = dataModels||{}; dataModels["i18n"] = i18nObj; 

	dataModels["lang"] = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
	
	dataModels["url"] = {url};
	new URL(url).searchParams.forEach((value, name) => dataModels["url"][name] = value);

	dataModels["_org_monkshu_makeLink"] = _ => (text, render) => router.encodeURL(render(text));
	dataModels["_org_monkshu_session"] = _ => (key, render) => session.get(render(key));

	return dataModels;
}

async function runShadowJSScripts(sourceDocument, documentToRunScriptOn) {
	// Including script files (as innerHTML does not execute the script included)
	const scriptsToInclude = Array.from(sourceDocument.querySelectorAll("script"));
	if (scriptsToInclude) for(const scriptThis of scriptsToInclude) {
		let scriptText;
		if (scriptThis.src && scriptThis.src !== "") scriptText = await(await fetch(scriptThis.src, {mode: "no-cors", cache: "default"})).text();
		else scriptText = scriptThis.innerText;

		const script = document.createElement("script");
		script.type = scriptThis.type;
		script.text = `${scriptText}\n//# sourceURL=${scriptThis.src||window.location.href}`;

		const whereToAppend = documentToRunScriptOn.querySelector("head")
		whereToAppend.appendChild(script).parentNode.removeChild(script);
	}
}

function isInHistory(url) {``
	const history = session.get("__org_monkshu_router_history");
	if (!history) return false;

	if (url.indexOf(HS) == -1) return false;
	
	let hash = url.substring(url.indexOf(HS)+HS.length);
	if (!history[hash]) return false; else return true;
}

function decodeURL(url) {
	const retURL = new URL(url, window.location.href).href;	// normalize
	if (retURL.indexOf(HS) == -1) return retURL; 
	const decoded = atob(retURL.substring(retURL.indexOf(HS)+HS.length)); return decoded;
}

function encodeURL(url) {
	url = new URL(url, window.location).href;
	const encodedURL = new URL(new URL(window.location.href).pathname+HS+btoa(url), window.location); 
	return encodedURL.toString();
}

const addOnLoadPage = (url, func) => { if (window.monkshu_env.pageload_funcs[url]) 
	window.monkshu_env.pageload_funcs[url].push(func); else window.monkshu_env.pageload_funcs[url] = [func]; }
const addOnLoadPageData = (url, func) => { if (window.monkshu_env.pagedata_funcs[url])
	window.monkshu_env.pagedata_funcs[url].push(func); else window.monkshu_env.pagedata_funcs[url] = [func]; }

const removeOnLoadPage = (url, func) => { if (window.monkshu_env.pageload_funcs[url] && window.monkshu_env.pageload_funcs[url].indexOf(func)!=-1) 
	window.monkshu_env.pageload_funcs[url].splice(window.monkshu_env.pageload_funcs[url].indexOf(func)) }
const removeOnLoadPageData = (url, func) => { if (window.monkshu_env.pagedata_funcs[url] && window.monkshu_env.pagedata_funcs[url].indexOf(func)!=-1) 
	window.monkshu_env.pagedata_funcs[url].splice(window.monkshu_env.pagedata_funcs[url].indexOf(func)) }

const doIndexNavigation = _ => window.location = window.location.origin;

const getCurrentURL = _ => router.decodeURL(window.location.href);
const getCurrentPageData = _ => session.get($$.MONKSHU_CONSTANTS.PAGE_DATA);
const setCurrentPageData = data => session.set($$.MONKSHU_CONSTANTS.PAGE_DATA, data);

const getLastSessionURL = _ => session.get($$.MONKSHU_CONSTANTS.PAGE_URL);

function reload() {loadPage(session.get($$.MONKSHU_CONSTANTS.PAGE_URL),session.get($$.MONKSHU_CONSTANTS.PAGE_DATA));}

export const router = {reload, loadPage, loadHTML, isInHistory, runShadowJSScripts, getPageData, expandPageData, decodeURL, 
	encodeURL, addOnLoadPage, removeOnLoadPage, addOnLoadPageData, removeOnLoadPageData, getCurrentURL, getCurrentPageData, 
	setCurrentPageData, doIndexNavigation, getLastSessionURL};
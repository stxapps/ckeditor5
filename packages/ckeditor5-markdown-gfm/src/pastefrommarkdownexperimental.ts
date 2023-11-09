/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module markdown-gfm/markdown
 */

import { Plugin, type Editor } from 'ckeditor5/src/core';
import GFMDataProcessor from './gfmdataprocessor';
import type { ClipboardPipeline, ClipboardInputTransformationEvent } from 'ckeditor5/src/clipboard';
import type { ViewDocumentKeyDownEvent } from 'ckeditor5/src/engine';

/**
 * The GitHub Flavored Markdown (GFM) paste plugin.
 *
 * // TODO add correct link to the guide.
 */
export default class PasteFromMarkdownExperimental extends Plugin {
	/**
	 * @internal
	 */
	private _gfmDataProcessor: GFMDataProcessor;

	/**
	 * @inheritDoc
	 */
	constructor( editor: Editor ) {
		super( editor );

		this._gfmDataProcessor = new GFMDataProcessor( editor.data.viewDocument );
	}

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'PasteFromMarkdownExperimental' as const;
	}

	/**
	 * @inheritDoc
	 */
	public static get requires() {
		return [ 'ClipboardPipeline' ] as const;
	}

	/**
	 * @inheritDoc
	 */
	public init(): void {
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;

		const clipboardPipeline: ClipboardPipeline = editor.plugins.get( 'ClipboardPipeline' );

		let shiftPressed = false;

		this.listenTo<ViewDocumentKeyDownEvent>( viewDocument, 'keydown', ( evt, data ) => {
			shiftPressed = data.shiftKey;
		} );

		this.listenTo<ClipboardInputTransformationEvent>( clipboardPipeline, 'inputTransformation', ( evt, data ) => {
			const dataAsTextHtml = data.dataTransfer.getData( 'text/html' );
			const markdownFromHtml = this.parseMarkdownFromHtml( dataAsTextHtml );

			if ( shiftPressed ) {
				return;
			}

			if ( !dataAsTextHtml ) {
				const dataAsTextPlain = data.dataTransfer.getData( 'text/plain' );
				data.content = this._gfmDataProcessor.toView( dataAsTextPlain );

				return;
			}

			if ( markdownFromHtml ) {
				data.content = this._gfmDataProcessor.toView( markdownFromHtml );
			}
		} );
	}

	/**
	 * Determines if code copied from a website in `text/html` type can be parsed as markdown.
	 * It removes any OS specific HTML tags e.g. <meta> on Mac OS and <!--StartFragment--> on Windows.
	 * Then removes a single wrapper HTML tag, and if there are no more tags left, returns the remaining text.
	 * Returns null, if there are any remaining HTML tags detected.
	 *
	 * @param {String} htmlString Clipboard content in `text/html` type format.
	 * @private
	 * @returns String | null
	 */
	private parseMarkdownFromHtml( htmlString = '' ) {
		// Removing <meta> tag present on Mac.
		const withoutMetaTag = htmlString.replace( /^<meta\b[^>]*>/, '' ).trim();
		// Removing <html> tag present on Windows.
		const withoutHtmlTag = withoutMetaTag.replace( /^<html>/, '' ).replace( /<\/html>$/, '' ).trim();
		// Removing <body> tag present on Windows.
		const withoutBodyTag = withoutHtmlTag.replace( /^<body>/, '' ).replace( /<\/body>$/, '' ).trim();
		// Removing <!--StartFragment--> tag present on Windows.
		const withoutFragmentTag = withoutBodyTag.replace( /^<!--StartFragment-->/, '' ).replace( /<!--EndFragment-->$/, '' ).trim();
		// Removing a wrapper HTML tag if exists.
		const withoutWrapperTag = withoutFragmentTag.replace( /^<(\w+)\b[^>]*>\s*([\s\S]*?)\s*<\/\1>/, '$2' ).trim();
		const containsAnyRemainingHtmlTags = /<[^>]+>[\s\S]*<[^>]+>/.test( withoutWrapperTag );

		if ( containsAnyRemainingHtmlTags ) {
			return null;
		}

		return withoutWrapperTag;
	}
}

/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import ModelTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor';
import HorizontalLineEditing from '@ckeditor/ckeditor5-horizontal-line/src/horizontallineediting';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import { getData, setData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { assertEqualMarkup } from '@ckeditor/ckeditor5-utils/tests/_utils/utils';

import TableEditing from '../../src/tableediting';
import TableSelection from '../../src/tableselection';
import { assertSelectedCells, modelTable } from '../_utils/utils';

import InsertRowCommand from '../../src/commands/insertrowcommand';
import TableCellPropertiesEditing from '../../src/tablecellproperties/tablecellpropertiesediting';

describe( 'InsertRowCommand', () => {
	let editor, model, command;

	beforeEach( () => {
		return ModelTestEditor
			.create( {
				plugins: [ Paragraph, TableEditing, TableSelection, HorizontalLineEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
			} );
	} );

	afterEach( () => {
		return editor.destroy();
	} );

	describe( 'order=below', () => {
		beforeEach( () => {
			command = new InsertRowCommand( editor );
		} );

		describe( 'isEnabled', () => {
			it( 'should be false if wrong node', () => {
				setData( model, '<paragraph>foo[]</paragraph>' );
				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in table', () => {
				setData( model, modelTable( [ [ '[]' ] ] ) );
				expect( command.isEnabled ).to.be.true;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should insert row after current position', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00[]', '01' ],
					[ '', '' ],
					[ '10', '11' ]
				] ) );
			} );

			it( 'should insert row after current position (selection in block content)', () => {
				setData( model, modelTable( [
					[ '00' ],
					[ '<paragraph>[]10</paragraph>' ],
					[ '20' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00' ],
					[ '<paragraph>[]10</paragraph>' ],
					[ '' ],
					[ '20' ]
				] ) );
			} );

			it( 'should update table heading rows attribute when inserting row in headings section', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { headingRows: 2 } ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00[]', '01' ],
					[ '', '' ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { headingRows: 3 } ) );
			} );

			it( 'should not update table heading rows attribute when inserting row after headings section', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ],
					[ '20', '21' ]
				], { headingRows: 2 } ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ],
					[ '', '' ],
					[ '20', '21' ]
				], { headingRows: 2 } ) );
			} );

			it( 'should expand rowspan of a cell that overlaps inserted rows', () => {
				// +----+----+----+----+
				// | 00      | 02 | 03 |
				// +----+----+----+----+ <-- heading rows
				// | 10      | 12 | 13 |
				// +         +----+----+
				// |         | 22 | 23 |
				// +----+----+----+----+
				//                     ^-- heading columns
				setData( model, modelTable( [
					[ { contents: '00', colspan: 2 }, '02', '03' ],
					[ { contents: '10[]', colspan: 2, rowspan: 2 }, '12', '13' ],
					[ '22', '23' ]
				], { headingColumns: 3, headingRows: 1 } ) );

				command.execute();

				// +----+----+----+----+
				// | 00      | 02 | 03 |
				// +----+----+----+----+ <-- heading rows
				// | 10      | 12 | 13 |
				// +         +----+----+
				// |         |    |    |
				// +         +----+----+
				// |         | 22 | 23 |
				// +----+----+----+----+
				//                     ^-- heading columns
				assertEqualMarkup( getData( model ), modelTable( [
					[ { contents: '00', colspan: 2 }, '02', '03' ],
					[ { contents: '10[]', colspan: 2, rowspan: 3 }, '12', '13' ],
					[ '', '' ],
					[ '22', '23' ]
				], { headingColumns: 3, headingRows: 1 } ) );
			} );

			it( 'should not expand rowspan of a cell that does not overlaps inserted rows', () => {
				// +----+----+----+
				// | 00 | 01 | 02 |
				// +    +----+----+
				// |    | 11 | 12 |
				// +----+----+----+ <-- heading rows
				// | 20 | 21 | 22 |
				// +----+----+----+
				setData( model, modelTable( [
					[ { contents: '00', rowspan: 2 }, '01', '02' ],
					[ '11[]', '12' ],
					[ '20', '21', '22' ]
				], { headingRows: 2 } ) );

				command.execute();

				// +----+----+----+
				// | 00 | 01 | 02 |
				// +    +----+----+
				// |    | 11 | 12 |
				// +----+----+----+ <-- heading rows
				// |    |    |    |
				// +----+----+----+
				// | 20 | 21 | 22 |
				// +----+----+----+
				assertEqualMarkup( getData( model ), modelTable( [
					[ { contents: '00', rowspan: 2 }, '01', '02' ],
					[ '11[]', '12' ],
					[ '', '', '' ],
					[ '20', '21', '22' ]
				], { headingRows: 2 } ) );
			} );

			it( 'should properly calculate columns if next row has colspans', () => {
				// +----+----+----+
				// | 00 | 01 | 02 |
				// +    +----+----+
				// |    | 11 | 12 |
				// +----+----+----+ <-- heading rows
				// | 20           |
				// +----+----+----+
				setData( model, modelTable( [
					[ { contents: '00', rowspan: 2 }, '01', '02' ],
					[ '11[]', '12' ],
					[ { contents: '20', colspan: 3 } ]
				], { headingRows: 2 } ) );

				command.execute();

				// +----+----+----+
				// | 00 | 01 | 02 |
				// +    +----+----+
				// |    | 11 | 12 |
				// +----+----+----+ <-- heading rows
				// |    |    |    |
				// +----+----+----+
				// | 20           |
				// +----+----+----+
				assertEqualMarkup( getData( model ), modelTable( [
					[ { contents: '00', rowspan: 2 }, '01', '02' ],
					[ '11[]', '12' ],
					[ '', '', '' ],
					[ { contents: '20', colspan: 3 } ]
				], { headingRows: 2 } ) );
			} );

			it( 'should insert rows at the end of a table', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ],
					[ '', '' ]
				] ) );
			} );

			it( 'should insert a row when multiple rows are selected', () => {
				setData( model, modelTable( [
					[ '11', '12' ],
					[ '21', '22' ],
					[ '31', '32' ]
				] ) );

				const tableSelection = editor.plugins.get( TableSelection );
				const modelRoot = model.document.getRoot();

				tableSelection.setCellSelection(
					modelRoot.getNodeByPath( [ 0, 0, 0 ] ),
					modelRoot.getNodeByPath( [ 0, 1, 1 ] )
				);

				command.execute();

				assertEqualMarkup( getData( model, { withoutSelection: true } ), modelTable( [
					[ '11', '12' ],
					[ '21', '22' ],
					[ '', '' ],
					[ '31', '32' ]
				] ) );

				assertSelectedCells( model, [
					[ 1, 1 ],
					[ 1, 1 ],
					[ 0, 0 ],
					[ 0, 0 ]
				] );
			} );

			it( 'should insert a row when a widget in the table cell is selected', () => {
				setData( model, modelTable( [
					[ '11', '12' ],
					[ '21', '22' ],
					[ '31', '[<horizontalLine></horizontalLine>]' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model, { withoutSelection: true } ), modelTable( [
					[ '11', '12' ],
					[ '21', '22' ],
					[ '31', '<horizontalLine></horizontalLine>' ],
					[ '', '' ]
				] ) );
			} );

			it( 'should copy the row structure from the selected row', () => {
				// +----+----+----+
				// | 00 | 01      |
				// +----+----+----+
				// | 10 | 11 | 12 |
				// +----+----+----+
				setData( model, modelTable( [
					[ '[]00', { contents: '01', colspan: 2 } ],
					[ '10', '11', '12' ]
				] ) );

				command.execute();

				// +----+----+----+
				// | 00 | 01      |
				// +----+----+----+
				// |    |         |
				// +----+----+----+
				// | 10 | 11 | 12 |
				// +----+----+----+
				assertEqualMarkup( getData( model, { withoutSelection: true } ), modelTable( [
					[ '00', { contents: '01', colspan: 2 } ],
					[ '', { contents: '', colspan: 2 } ],
					[ '10', '11', '12' ]
				] ) );
			} );

			describe( 'integration with TableCellPropertiesEditing', () => {
				let editor, model, tableUtils, command;

				beforeEach( () => {
					return ModelTestEditor
						.create( {
							plugins: [ Paragraph, TableEditing, TableCellPropertiesEditing ]
						} )
						.then( newEditor => {
							editor = newEditor;
							model = editor.model;

							command = editor.commands.get( 'insertTableRowBelow' );
							tableUtils = editor.plugins.get( 'TableUtils' );
						} );
				} );

				afterEach( () => {
					return editor.destroy();
				} );

				it(
					'should pass the default cell styles to "TableUtils.insertRows()" function if TableCellPropertiesEditing is enabled',
					() => {
						const insertRowsStub = sinon.stub( tableUtils, 'insertRows' ).callThrough();

						setData( model, modelTable( [
							[ '11[]', '12' ]
						] ) );

						command.execute();

						expect( insertRowsStub.callCount ).to.equal( 1 );
						expect( insertRowsStub.firstCall.args[ 1 ] ).to.deep.equal( {
							at: 1,
							copyStructureFromAbove: true,
							defaultCellProperties: {
								horizontalAlignment: 'center',
								verticalAlignment: 'middle'
							}
						} );
					}
				);

				it( 'should create the table and all cells should have applied the default cell properties', () => {
					const defaultProperties = {
						borderStyle: 'solid',
						borderWidth: '2px',
						borderColor: '#f00',
						horizontalAlignment: 'right',
						verticalAlignment: 'bottom'
					};

					editor.config.set( 'table.tableCellProperties.defaultProperties', defaultProperties );

					// Apply default properties for the created table.
					setData( model, modelTable( [
						[ '11[]', '12' ]
					], { defaultCellProperties: defaultProperties } ) );

					command.execute();

					assertEqualMarkup( getData( model ),
						modelTable( [
							[ '11[]', '12' ],
							[ '', '' ]
						], { defaultCellProperties: defaultProperties } )
					);
				} );
			} );
		} );
	} );

	describe( 'order=above', () => {
		beforeEach( () => {
			command = new InsertRowCommand( editor, { order: 'above' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be false if wrong node', () => {
				setData( model, '<paragraph>foo[]</paragraph>' );
				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in table', () => {
				setData( model, modelTable( [ [ '[]' ] ] ) );
				expect( command.isEnabled ).to.be.true;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should insert row before current position (selection in block content)', () => {
				setData( model, modelTable( [
					[ '00' ],
					[ '<paragraph>[]10</paragraph>' ],
					[ '20' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00' ],
					[ '' ],
					[ '<paragraph>[]10</paragraph>' ],
					[ '20' ]
				] ) );
			} );

			it( 'should insert row at the beginning of a table', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '', '' ],
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ) );
			} );

			it( 'should insert row at the end of a table', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10', '11' ],
					[ '20[]', '21' ]
				] ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00', '01' ],
					[ '10', '11' ],
					[ '', '' ],
					[ '20[]', '21' ]
				] ) );
			} );

			it( 'should update table heading rows attribute when inserting row in headings section', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { headingRows: 2 } ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '', '' ],
					[ '00[]', '01' ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { headingRows: 3 } ) );
			} );

			it( 'should not update table heading rows attribute when inserting row after headings section', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10', '11' ],
					[ '20[]', '21' ]
				], { headingRows: 2 } ) );

				command.execute();

				assertEqualMarkup( getData( model ), modelTable( [
					[ '00', '01' ],
					[ '10', '11' ],
					[ '', '' ],
					[ '20[]', '21' ]
				], { headingRows: 2 } ) );
			} );

			it( 'should insert a row when multiple rows are selected', () => {
				setData( model, modelTable( [
					[ '11', '12' ],
					[ '21', '22' ],
					[ '31', '32' ]
				] ) );

				const tableSelection = editor.plugins.get( TableSelection );
				const modelRoot = model.document.getRoot();

				tableSelection.setCellSelection(
					modelRoot.getNodeByPath( [ 0, 0, 0 ] ),
					modelRoot.getNodeByPath( [ 0, 1, 1 ] )
				);

				command.execute();

				assertEqualMarkup( getData( model, { withoutSelection: true } ), modelTable( [
					[ '', '' ],
					[ '11', '12' ],
					[ '21', '22' ],
					[ '31', '32' ]
				] ) );

				assertSelectedCells( model, [
					[ 0, 0 ],
					[ 1, 1 ],
					[ 1, 1 ],
					[ 0, 0 ]
				] );
			} );

			it( 'should copy the row structure from the selected row', () => {
				// +----+----+----+
				// | 00 | 01      |
				// +----+----+----+
				// | 10 | 11 | 12 |
				// +----+----+----+
				setData( model, modelTable( [
					[ '[]00', { contents: '01', colspan: 2 } ],
					[ '10', '11', '12' ]
				] ) );

				command.execute();

				// +----+----+----+
				// |    |         |
				// +----+----+----+
				// | 00 | 01      |
				// +----+----+----+
				// | 10 | 11 | 12 |
				// +----+----+----+
				assertEqualMarkup( getData( model, { withoutSelection: true } ), modelTable( [
					[ '', { contents: '', colspan: 2 } ],
					[ '00', { contents: '01', colspan: 2 } ],
					[ '10', '11', '12' ]
				] ) );
			} );

			describe( 'integration with TableCellPropertiesEditing', () => {
				let editor, model, tableUtils, command;

				beforeEach( () => {
					return ModelTestEditor
						.create( {
							plugins: [ Paragraph, TableEditing, TableCellPropertiesEditing ]
						} )
						.then( newEditor => {
							editor = newEditor;
							model = editor.model;

							command = editor.commands.get( 'insertTableRowAbove' );
							tableUtils = editor.plugins.get( 'TableUtils' );
						} );
				} );

				afterEach( () => {
					return editor.destroy();
				} );

				it(
					'should pass the default cell styles to "TableUtils.insertRows()" function if TableCellPropertiesEditing is enabled',
					() => {
						const insertRowsStub = sinon.stub( tableUtils, 'insertRows' ).callThrough();

						setData( model, modelTable( [
							[ '11[]', '12' ]
						] ) );

						command.execute();

						expect( insertRowsStub.callCount ).to.equal( 1 );
						expect( insertRowsStub.firstCall.args[ 1 ] ).to.deep.equal( {
							at: 0,
							copyStructureFromAbove: false,
							defaultCellProperties: {
								horizontalAlignment: 'center',
								verticalAlignment: 'middle'
							}
						} );
					}
				);

				it( 'should create the table and all cells should have applied the default cell properties', () => {
					const defaultProperties = {
						borderStyle: 'solid',
						borderWidth: '2px',
						borderColor: '#f00',
						horizontalAlignment: 'right',
						verticalAlignment: 'bottom'
					};

					editor.config.set( 'table.tableCellProperties.defaultProperties', defaultProperties );

					// Apply default properties for the created table.
					setData( model, modelTable( [
						[ '11[]', '12' ]
					], { defaultCellProperties: defaultProperties } ) );

					command.execute();

					assertEqualMarkup( getData( model ),
						modelTable( [
							[ '', '' ],
							[ '11[]', '12' ]
						], { defaultCellProperties: defaultProperties } )
					);
				} );
			} );
		} );
	} );
} );

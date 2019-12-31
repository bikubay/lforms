/**
 * Create link id using other than _codePath.
 *
 * @param lfItems
 * @param codeList
 */
function createLinkId(lfItems, codeList) {
  if(!lfItems || !lfItems.length > 0) {
    return;
  }

  if(!codeList) {
    codeList = [];
  }

  lfItems.forEach(function(item){
    codeList.push(item.questionCode);
    item.linkId = codeList.join('_');
    createLinkId(item.items, codeList);
    codeList.pop();
  });
}


// Tests for FHIR SDC library
var fhirVersions = Object.keys(LForms.Util.FHIRSupport);
for (var i=0, len=fhirVersions.length; i<len; ++i) {
  (function (fhirVersion) {
    var fhir = LForms.FHIR[fhirVersion];
    describe(fhirVersion, function() {
      describe('FHIR SDC library', function() {
        describe('_significantDigits', function() {
          it('should count zeros left of the decimal', function() {
            // This is because users are not likely to enter number in
            // scientific notation.
            assert.equal(fhir.SDC._significantDigits(12300), 5);
          });
          it('should count digits right of the decimal', function() {
            assert.equal(fhir.SDC._significantDigits(12.01), 4);
          });
        });

        describe('Round trip conversion', function() {
          it('should preserve extensions on _title', function (){
            var questionnaire = {
              _title: {
                extension: [{
                  "url": "http://hl7.org/fhir/StructureDefinition/rendering-style",
                  "valueString": "color: green"
                }]
              }
            };
            var lfData = fhir.SDC.convertQuestionnaireToLForms(questionnaire);
            var qData = fhir.SDC.convertLFormsToQuestionnaire(lfData);
            assert.ok(qData._title);
            assert.deepEqual(qData._title, questionnaire._title);
          });

          it('should correctly translate name & title fields', function (){
            var questionnaire = {
              name: 'FHP',
              title: 'Family Health Portrait'
            };
            var lfData = fhir.SDC.convertQuestionnaireToLForms(questionnaire);
            assert.equal(lfData.name, questionnaire.title);
            var qData = fhir.SDC.convertLFormsToQuestionnaire(lfData);
            assert.equal(qData.title, questionnaire.title);
            assert.equal(qData.name, questionnaire.name);
          });

          it('should preserve extensions on item._prefix & _text', function (){
            var questionnaire = {
              item: [{
                _prefix: {
                  extension: [{
                    "url": "http://hl7.org/fhir/StructureDefinition/rendering-style",
                    "valueString": "color: green"
                  }]
                },
                _text: {
                  extension: [{
                    "url": "http://hl7.org/fhir/StructureDefinition/rendering-style",
                    "valueString": "color: green"
                  }]
                }
              }]
            };
            var lfData = fhir.SDC.convertQuestionnaireToLForms(questionnaire);
            var qData = fhir.SDC.convertLFormsToQuestionnaire(lfData);
            assert.ok(qData.item[0]._prefix);
            assert.deepEqual(qData.item[0]._prefix, questionnaire.item[0]._prefix);
            assert.ok(qData.item[0]._text);
            assert.deepEqual(qData.item[0]._text, questionnaire.item[0]._text);
          });

        });

        describe('itemToQuestionnaireItem', function() {

          it('should convert code system', function() {

            var codeSystem = "LOINC";
            var fhirCodeSystem = LForms.Util.getCodeSystem(codeSystem);
            assert.equal(fhirCodeSystem, "http://loinc.org");
          });

          it('should covert an item with ST data type', function () {
            var item = {
              "questionCodeSystem":"LOINC",
              "questionCode": "54125-0",
              "questionCardinality": {"min": "1", "max": "*"},
              "question": "Name",
              "dataType": "ST",
              "_codePath": "/54126-8/54125-0",
              "_idPath": "/1/1"
            };

            var out = fhir.SDC._processItem(LForms.Util.initializeCodes(item), {});
            assert.equal(out.required, undefined);
            assert.equal(out.repeats, true);
            assert.equal(out.linkId, "/54126-8/54125-0");
            assert.equal(out.text, "Name");
            assert.equal(out.type, "string");
            assert.equal(out.code[0].system,"http://loinc.org");
            assert.equal(out.code[0].code,"54125-0");

          });

          it('should covert an item with QTY data type to type quantity in FHIR Questionnaire', function () {
            var item = {
              "questionCodeSystem":"ad-hoc",
              "questionCode": "12345",
              "questionCardinality": {"min": "1", "max": "1"},
              "question": "fill in weight",
              "dataType": "QTY",
              "_codePath": "/weight"
            };
            var out = fhir.SDC._processItem(LForms.Util.initializeCodes(item), {});
            assert.equal(out.linkId, "/weight");
            assert.equal(out.type, "quantity");
            assert.equal(out.code[0].system, "ad-hoc");
            assert.equal(out.code[0].code,"12345");

          });

          it('should convert an item with CNE data type without answerCodeSystem', function () {
            var cneFixture = window[fhirVersion+'_'+'cneDataTypeFixture'];
            var out = fhir.SDC._processItem(LForms.Util.initializeCodes(cneFixture.input), {});
            assert.deepEqual(out, cneFixture.output);
          });

          it('should convert an item with answerCodeSystem', function () {
            var alFixture = window[fhirVersion+'_'+'alWithCodeSystemFixture'];
            var out = fhir.SDC._processItem(LForms.Util.initializeCodes(alFixture.input), {});
            assert.deepEqual(out, alFixture.output);
          });

          it('should convert an item with SECTION data type, with skip logic and sub items', function () {
            var item = {
              "questionCode": "54137-5X",
              "questionCardinality": {"min": "1", "max": "*"},
              "question": "Mock-up section: Shown when Height = 15",
              "dataType": "SECTION",
              // level 3
              "items": [
                { "questionCode": "54140-9X",
                  "questionCardinality": {"min": "1", "max": "1"},
                  "question": "Mock-up sub item #1",
                  "dataType": "INT",
                  "_codePath": "/54126-8/54137-5X/54140-9X",
                  "_idPath": "/1/1/1"
                },
                {
                  "questionCode": "54130-0X",
                  "questionCardinality": {"min": "1", "max": "1"},
                  "question": "Mock-up sub item #2",
                  "dataType": "REAL",
                  "_codePath": "/54126-8/54137-5X/54130-0X",
                  "_idPath": "/1/1/1"
                }
              ],
              "_codePath": "/54126-8/54137-5X",
              "_idPath": "/1/1"
            };

            var out = fhir.SDC._processItem(LForms.Util.initializeCodes(item), {});
            assert.equal(out.required, undefined);
            assert.equal(out.repeats, true);
            assert.equal(out.linkId, "/54126-8/54137-5X");
            assert.equal(out.text, "Mock-up section: Shown when Height = 15");
            assert.equal(out.type, "group");

            assert.equal(out.item.length, 2);
            assert.equal(out.item[0].required, undefined);
            assert.equal(out.item[0].repeats, undefined);
            assert.equal(out.item[0].linkId, "/54126-8/54137-5X/54140-9X");
            assert.equal(out.item[0].text,"Mock-up sub item #1");
            assert.equal(out.item[0].type,"integer");
            assert.equal(out.item[1].required, undefined);
            assert.equal(out.item[1].repeats, undefined);
            assert.equal(out.item[1].linkId, "/54126-8/54137-5X/54130-0X");
            assert.equal(out.item[1].text,"Mock-up sub item #2");
            assert.equal(out.item[1].type,"decimal");

          });

          it('should convert FHTData to Questionnaire', function () {
            var fhirQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, angular.copy(FHTData));
            assert.equal(fhirQ.item[0].item[2].item.length, 1);
            assert.equal(fhirQ.item[0].item[2].item[0].text,
                "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://lforms-demo3.nlm.nih.gov'>coding instruction</a>");
            assert.equal(fhirQ.item[0].item[2].item[0].extension[0].url, "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl");
            assert.equal(fhirQ.item[0].item[2].item[0].extension[0].valueCodeableConcept.coding[0].code, "help");
            assert.equal(fhirQ.item[0].item[2].item[0].extension[0].valueCodeableConcept.coding[0].system, "http://hl7.org/fhir/questionnaire-item-control");
            if (fhirVersion === "R4") {
              assert.equal(fhirQ.item[0].item[2].item[0]._text.extension[0].url,
                  "http://hl7.org/fhir/StructureDefinition/rendering-xhtml")
              assert.equal(fhirQ.item[0].item[2].item[0]._text.extension[0].valueString,
                  "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://lforms-demo3.nlm.nih.gov'>coding instruction</a>")
            }
          });

        });

        describe('Questionnaire to lforms item conversion', function () {
          it('should convert defaultAnswers',function () {
            var fixtures = window['defaultAnswers'];
            for (var i = 0; i < fixtures.length; i++) {
              var fixture = angular.copy(fixtures[i]);
              // STU3 does not support multiple default answers.
              if (!Array.isArray(fixture.defaultAnswer) || fhirVersion === 'R4') {
                var qItem = {};

                qItem.type = LForms.FHIR[fhirVersion].SDC._getFhirDataType(fixture);
                LForms.FHIR[fhirVersion].SDC._handleInitialValues(qItem,fixture);
                // Default processing depends on the answer repeat.
                if (fixture.answerCardinality && fixture.answerCardinality.max === "*") {
                  qItem.extension = [];
                  qItem.extension.push({
                    "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-answerRepeats",
                    "valueBoolean": true
                  });
                }
                var lfItem = {};
                lfItem.answerCardinality = fixture.answerCardinality;
                LForms.FHIR[fhirVersion].SDC._processDataType(lfItem,qItem);
                lfItem.answers = fixture.answers;
                LForms.FHIR[fhirVersion].SDC._processDefaultAnswer(lfItem,qItem);
                assert.deepEqual(lfItem.defaultAnswer,fixture.defaultAnswer);
              }
            }
          });

          it('should convert questionnaire.code and item.code with code system',function () {


            var formCodes = [{
              system: 'http://form-example1.com',
              version: '1.0',
              code: 'formcode1',
              display: 'Form Code 1',
              userSelected: true
            }, {
              system: 'http://form-example2.com',
              version: '2.0',
              code: 'formcode2',
              display: 'Form Code 2',
              userSelected: false
            }, {
              system: 'http://form-example3.com',
              version: '3.0',
              code: 'formcode3',
              display: 'Form Code 3',
              userSelected: false
            }];

            var itemCodes = [{
              system: 'http://example1.com',
              version: '1.0',
              code: 'code1',
              display: 'Code 1',
              userSelected: true
            }, {
              system: 'http://example2.com',
              version: '2.0',
              code: 'code2',
              display: 'Code 2',
              userSelected: false
            }, {
              system: 'http://example3.com',
              version: '3.0',
              code: 'code3',
              display: 'Code 3',
              userSelected: false
            }];

            var fhirData = {
              title: 'test title',
              name: 'test name',
              version: '0.0.1',
              resourceType: 'Questionnaire',
              "meta": {
                "profile": [
                  "http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire"
                ]
              },
              status: 'draft',
              code: formCodes,
              item: [{
                required: true,
                extension: [{
                  "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs",
                  "valueInteger": 1
                }],
                text: 'FHIR Item with multiple codes',
                linkId: '12345',
                type: 'string',
                code: itemCodes
              }]
            };
            var lfData = fhir.SDC.convertQuestionnaireToLForms(fhirData);
            assert.equal(lfData.code, 'formcode1');
            assert.equal(lfData.codeSystem, 'http://form-example1.com');
            assert.equal(lfData.name, 'test title');
            assert.equal(lfData.version, '0.0.1');
            assert.equal(lfData.codeList, formCodes);

            assert.equal(lfData.items[0].questionCode, 'code1');
            assert.equal(lfData.items[0].questionCodeSystem, 'http://example1.com');
            assert.equal(lfData.items[0].codeList, itemCodes);

            var convertedFhirData = fhir.SDC.convertLFormsToQuestionnaire(lfData);
            
            assert.deepEqual(fhirData.code, convertedFhirData.code);
            assert.deepEqual(fhirData.item[0].extension, convertedFhirData.item[0].extension);
            //assert.deepEqual(fhirData, convertedFhirData);

          });
          it('should convert questionnaire.code and item.code, without code system',function () {


            var formCodes = [{
              version: '1.0',
              code: 'formcode1',
              display: 'Form Code 1',
              userSelected: true
            }, {
              version: '2.0',
              code: 'formcode2',
              display: 'Form Code 2',
              userSelected: false
            }, {
              system: 'http://form-example3.com',
              version: '3.0',
              code: 'formcode3',
              display: 'Form Code 3',
              userSelected: false
            }];

            var itemCodes = [{
              version: '1.0',
              code: 'code1',
              display: 'Code 1',
              userSelected: true
            }, {
              version: '2.0',
              code: 'code2',
              display: 'Code 2',
              userSelected: false
            }, {
              system: 'http://example3.com',
              version: '3.0',
              code: 'code3',
              display: 'Code 3',
              userSelected: false
            }];

            var fhirData = {
              title: 'test title',
              name: 'test name',
              version: '0.0.1',
              resourceType: 'Questionnaire',
              "meta": {
                "profile": [
                  "http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire"
                ]
              },
              status: 'draft',
              code: formCodes,
              item: [{
                required: true,
                extension: [{
                  "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs",
                  "valueInteger": 1
                }],
                text: 'FHIR Item with multiple codes',
                linkId: '12345',
                type: 'string',
                code: itemCodes
              }]
            };
            var lfData = fhir.SDC.convertQuestionnaireToLForms(fhirData);
            assert.equal(lfData.code, 'formcode1');
            assert.equal(lfData.codeSystem, undefined);
            assert.equal(lfData.name, 'test title');
            assert.equal(lfData.version, '0.0.1');
            assert.equal(lfData.codeList, formCodes);

            assert.equal(lfData.items[0].questionCode, 'code1');
            assert.equal(lfData.items[0].questionCodeSystem, undefined);
            assert.equal(lfData.items[0].codeList, itemCodes);

            var convertedFhirData = fhir.SDC.convertLFormsToQuestionnaire(lfData);

            // console.log( JSON.stringify(convertedFhirData))
            // console.log( JSON.stringify(fhirData))
            assert.deepEqual(fhirData, convertedFhirData);

          });

          it('should covert prefix of an item', function () {
            var fhirData = {
              title: 'test title',
              name: 'test name',
              version: '0.0.1',
              resourceType: 'Questionnaire',
              "meta": {
                "profile": [
                  "http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire"
                ]
              },
              status: 'draft',
              item: [{
                text: 'item a',
                linkId: '1',
                type: 'string',
                prefix: "A:"
              },
                {
                  text: 'item b',
                  linkId: '2',
                  type: 'string'
                }]
            };
            var out = fhir.SDC.convertQuestionnaireToLForms(fhirData);
            assert.equal(out.items[0].prefix, "A:");
            assert.equal(out.items[1].prefix, undefined);
          });

          it('should convert FHTData to lforms', function () {
            var fhtClone = angular.copy(FHTData);
            createLinkId(fhtClone.items);
            var fhirQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, fhtClone);
            var convertedLfData = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQ, fhirVersion);
            convertedLfData = new LForms.LFormsData(convertedLfData);
            var reConvertedFhirQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, convertedLfData);
            assert.deepEqual(reConvertedFhirQ, fhirQ);

            assert.equal(convertedLfData.name, 'USSG-FHT, (with mock-up items for skip logic demo)');
            assert.equal(convertedLfData.code, '54127-6N');
            assert.equal(convertedLfData.codeSystem, 'LOINC');
            assert.equal(convertedLfData.codeList.length, 1);
            assert.equal(convertedLfData.codeList[0].code, '54127-6N');
            assert.equal(convertedLfData.codeList[0].system, 'http://loinc.org');
            assert.equal(convertedLfData.codeList[0].display, 'USSG-FHT, (with mock-up items for skip logic demo)');
            assert.equal(convertedLfData.items.length, 2);
            assert.equal(convertedLfData.items[0].question, "Your health information");
            assert.equal(convertedLfData.items[0].questionCode, "54126-8");
            assert.equal(convertedLfData.items[0].questionCodeSystem, undefined);
            assert.equal(convertedLfData.items[0].codeList.length, 1);
            assert.equal(convertedLfData.items[0].codeList[0].display, "Your health information");
            assert.equal(convertedLfData.items[0].codeList[0].code, "54126-8");
            assert.equal(convertedLfData.items[0].codeList[0].system, undefined);
            assert.equal(convertedLfData.items[0].dataType, 'SECTION');
            assert.equal(convertedLfData.items[0].header, true);
            assert.equal(convertedLfData.items[0].items.length, 13);

            assert.equal(convertedLfData.items[0].items[0].question, "Name");
            assert.equal(convertedLfData.items[0].items[0].questionCode, "54125-0");
            assert.equal(convertedLfData.items[0].items[0].questionCodeSystem, undefined);
            assert.equal(convertedLfData.items[0].items[0].questionCardinality.min, "1");
            assert.equal(convertedLfData.items[0].items[0].questionCardinality.max, "*");
            assert.equal(convertedLfData.items[0].items[0].questionCodeSystem, undefined);
            assert.equal(convertedLfData.items[0].items[0].dataType, 'TX');

            assert.equal(convertedLfData.items[0].items[1].answers.length, 3);
            assert.equal(convertedLfData.items[0].items[1].answers[0].text, "Male");
            assert.equal(convertedLfData.items[0].items[1].answers[0].code, "LA2-8");
            assert.equal(convertedLfData.items[0].items[1].answers[2].text, "Other");
            assert.equal(convertedLfData.items[0].items[1].answers[2].code, "LA46-8");
            // TODO - other not supported
            //assert.equal(convertedLfData.items[0].items[1].answers[2].other, "Please Specify");
            assert.equal(convertedLfData.items[0].items[1].dataType, "CNE");

            // TODO - skip logic triggers for min/max inclusive/exclusive are not supported.
            // Only skip logic 'value' works in STU3
            assert.deepEqual(convertedLfData.items[0].items[4].skipLogic, fhtClone.items[0].items[4].skipLogic);
            assert.deepEqual(convertedLfData.items[0].items[12].items[2].skipLogic, fhtClone.items[0].items[12].items[2].skipLogic);
            if(fhirVersion !== 'STU3') {
              assert.deepEqual(convertedLfData.items[0].items[6].items[1].skipLogic, fhtClone.items[0].items[6].items[1].skipLogic);
              assert.deepEqual(convertedLfData.items[0].items[6].items[2].skipLogic, fhtClone.items[0].items[6].items[2].skipLogic);
              assert.deepEqual(convertedLfData.items[0].items[5].items[0].skipLogic, fhtClone.items[0].items[5].items[0].skipLogic);
              assert.deepEqual(convertedLfData.items[0].items[5].items[1].skipLogic, fhtClone.items[0].items[5].items[1].skipLogic);
            }

            assert.equal(convertedLfData.items[0].items[2].codingInstructions,
                "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://lforms-demo3.nlm.nih.gov'>coding instruction</a>");
            assert.equal(convertedLfData.items[0].items[2].codingInstructionsFormat, "html");
            assert.equal(convertedLfData.items[0].items[2].codingInstructionsPlain,
                  "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://lforms-demo3.nlm.nih.gov'>coding instruction</a>");

            assert.equal(convertedLfData.items[0].items[6].answerCardinality.min, "1");
            assert.equal(convertedLfData.items[0].items[6].codingInstructions, "Try to type 10, 12, 15, 16, 25");
            assert.equal(convertedLfData.items[0].items[6].codingInstructionsFormat, "text");
            assert.equal(convertedLfData.items[0].items[6].codingInstructionsPlain, "Try to type 10, 12, 15, 16, 25");

            // TODO units[x].code is not supported.
            assert.equal(convertedLfData.items[0].items[6].units.length, fhtClone.items[0].items[6].units.length);
            assert.equal(convertedLfData.items[0].items[6].units[0].default, fhtClone.items[0].items[6].units[0].default);
            assert.equal(convertedLfData.items[0].items[6].units[0].name, fhtClone.items[0].items[6].units[0].name);
            assert.equal(convertedLfData.items[0].items[6].units[1].name, fhtClone.items[0].items[6].units[1].name);

            // Display control
            fhirQ = fhir.SDC.convertLFormsToQuestionnaire(new LForms.LFormsData(angular.copy(displayControlsDemo)));
            convertedLfData = fhir.SDC.convertQuestionnaireToLForms(fhirQ);

            // TODO -
            // unsupported fields: viewMode, css, colCSS, listColHeaders, answerLayout.columns
            // supported fields: questionLayout, answerLayout.type
            assert.equal(convertedLfData.items[1].displayControl.answerLayout.type, "RADIO_CHECKBOX");
            // Vertical layout is not converted as it is default.
            assert.equal(convertedLfData.items[5].displayControl, undefined);
            assert.equal(convertedLfData.items[6].displayControl.questionLayout, "horizontal");
          });

          describe('Units', function () {
            var lforms = null;
            beforeEach(function(){
              lforms = angular.copy(window['units_example']);
            });

            it('should convert units to unitOption extension', function () {
              // Export
              var fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);
              // There is no default answer and default unit.
              if(fhirVersion === 'STU3') {
                assert.equal(fhirQ.item[0].initialQuantity, undefined);
              }
              else {
                assert.equal(fhirQ.item[0].initial, undefined);
              }
              //assert.equal(fhirQ.item[0].type, 'decimal');
              // Add default answer to convert to quantity type - no default unit set.
              lforms.items[0].defaultAnswer = 1.0;
              fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);
              var qty = null;
              if(fhirVersion === 'STU3') {
                qty = fhirQ.item[0].initialQuantity;
              }
              else {
                qty = fhirQ.item[0].initial[0].valueQuantity;
              }
              assert.equal(qty.value, 1.0);
              assert.equal(qty.unit, lforms.items[0].units[0].name);
              assert.equal(qty.code, lforms.items[0].units[0].code);
              assert.equal(qty.system, lforms.items[0].units[0].system);
              assert.equal(fhirQ.item[0].type, 'quantity');

              // With default unit and default answer.
              lforms.items[0].units[0].default = true;
              fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);
              var qty = null;
              if(fhirVersion === 'STU3') {
                qty = fhirQ.item[0].initialQuantity;
              }
              else {
                qty = fhirQ.item[0].initial[0].valueQuantity;
              }
              assert.equal(qty.value, 1.0);
              assert.equal(qty.unit, lforms.items[0].units[0].name);
              assert.equal(qty.code, lforms.items[0].units[0].code);
              assert.equal(qty.system, lforms.items[0].units[0].system);
              assert.equal(fhirQ.item[0].type, 'quantity');

              // Default unit set without default answer.
              delete lforms.items[0].defaultAnswer;
              lforms.items[0].units[0].default = true;
              fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);
              var qty = null;
              if(fhirVersion === 'STU3') {
                qty = fhirQ.item[0].initialQuantity;
              }
              else {
                qty = fhirQ.item[0].initial[0].valueQuantity;
              }
              assert.equal(qty.value, undefined);
              assert.equal(qty.unit, lforms.items[0].units[0].name);
              assert.equal(qty.code, lforms.items[0].units[0].code);
              assert.equal(qty.system, lforms.items[0].units[0].system);
              assert.equal(fhirQ.item[0].type, 'quantity');

              var unitOptions = LForms.Util.findObjectInArray(fhirQ.item[0].extension, 'url', 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption', 0, true);
              assert.equal(unitOptions.length, lforms.items[0].units.length);
              var i = 0;
              for(i = 0; i < unitOptions.length; i++) {
                assert.equal(unitOptions[i].valueCoding.code, lforms.items[0].units[i].code);
                assert.equal(unitOptions[i].valueCoding.display, lforms.items[0].units[i].name);
                assert.equal(unitOptions[i].valueCoding.system, lforms.items[0].units[i].system);
              }

              // Import
              var convertedLfData = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQ, fhirVersion);

              assert.equal(convertedLfData.items[0].dataType, 'QTY');
              assert.equal(convertedLfData.items[0].units.length, lforms.items[0].units.length);
              for(i = 0; i < convertedLfData.items[0].units.length; i++) {
                assert.equal(convertedLfData.items[0].units[i].name, lforms.items[0].units[i].name);
                assert.equal(convertedLfData.items[0].units[i].code, lforms.items[0].units[i].code);
                assert.equal(convertedLfData.items[0].units[i].system, lforms.items[0].units[i].system);
              }
              assert.isOk(convertedLfData.items[0].units[0].default);
            });

            it('should convert default unit to initial quantity unit', function () {
              lforms.items[0].units[2].default = true;
              // Export
              var fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);
              var qty = null;
              if(fhirVersion === 'STU3') {
                qty = fhirQ.item[0].initialQuantity;
              }
              else {
                qty = fhirQ.item[0].initial[0].valueQuantity;
              }

              assert.equal(qty.unit, lforms.items[0].units[2].name);
              assert.equal(qty.code, lforms.items[0].units[2].code);
              assert.equal(qty.system, lforms.items[0].units[2].system);

              // Import
              var convertedLfData = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQ, fhirVersion);

              assert.equal(convertedLfData.items[0].units.length, lforms.items[0].units.length);
              assert.isOk(convertedLfData.items[0].units[2].default);
            });

            it('should convert a single unit for type REAL to questionnaire unit extention', function() {
              lforms.items[0].units.splice(1);
              lforms.items[0].dataType = 'REAL';
              // Export
              var fhirQ = LForms.FHIR[fhirVersion].SDC.convertLFormsToQuestionnaire(lforms);

              var unitOption = LForms.Util.findObjectInArray(fhirQ.item[0].extension, 'url', LForms.FHIR[fhirVersion].SDC.fhirExtUrlUnitOption);

              assert.isNotOk(unitOption);
              if(fhirVersion === 'STU3') assert.isUndefined(fhirQ.item[0].initialQuantity);
              if(fhirVersion === 'R4') assert.isUndefined(fhirQ.item[0].initial);

              var qUnit = LForms.Util.findObjectInArray(fhirQ.item[0].extension, 'url', LForms.FHIR[fhirVersion].SDC.fhirExtUrlUnit);

              assert.equal(qUnit.valueCoding.code, lforms.items[0].units[0].code);
              assert.equal(qUnit.valueCoding.display, lforms.items[0].units[0].name);
              assert.equal(qUnit.valueCoding.system, lforms.items[0].units[0].system);

              // Import
              var convertedLfData = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQ, fhirVersion);

              assert.equal(convertedLfData.items[0].dataType, lforms.items[0].dataType);
              assert.equal(convertedLfData.items[0].units.length, 1);
              assert.equal(convertedLfData.items[0].units[0].name, lforms.items[0].units[0].name);
              assert.equal(convertedLfData.items[0].units[0].code, lforms.items[0].units[0].code);
              assert.equal(convertedLfData.items[0].units[0].system, lforms.items[0].units[0].system);
              assert.isOk(convertedLfData.items[0].units[0].default);
            });
          });

          it('should convert FHIR Questionnaire quantity item to LForms QTY item', function () {
            var fhirData = {
              item: [{
                text: 'fill in weight',
                linkId: '12345',
                type: 'quantity'
              }]
            };
            var lfItem = fhir.SDC._processQuestionnaireItem(fhirData.item[0], fhirData);
            assert.equal(lfItem.dataType, 'QTY');
          });

          it('should convert FHIR Questionnaire initial quantity value to LForms QTY item value', function () {
            var fhirData = {
              item: [{
                text: 'fill in weight',
                linkId: '12345',
                type: 'quantity'
              }]
            };
            if(fhirVersion === 'R4') {
              fhirData.item[0].initial = [{valueQuantity: {value: 222}}];
            }
            else { // STU3
              fhirData.item[0].initialQuantity = {value: 222};
            }

            var lfItem = fhir.SDC._processQuestionnaireItem(fhirData.item[0], fhirData);
            assert.equal(lfItem.dataType, 'QTY');
            assert.equal(lfItem.defaultAnswer, 222);
          });

          it('should convert/merge FHIR valueQuantity to LForms QTY item value', function () {
            var lfItem = {
              "questionCodeSystem":"ad-hoc",
              "questionCode": "12345",
              "linkId": "12345",
              "question": "fill in weight",
              "dataType": "QTY"
            };
            var fhirAnswer = [{
              valueQuantity: { value: 128, code: "kg"}
            }];
            fhir.SDC._mergeQR._setupItemValueAndUnit('12345', fhirAnswer, lfItem);
            assert.equal(lfItem.value, 128);
            assert.equal(lfItem.unit.name, "kg");
          });

          it('should convert restrictions', function () {
            var fhirQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, angular.copy(validationTestForm));
            var convertedLfData = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQ, fhirVersion);

            assert.equal(convertedLfData.items.length, 34);
            // TODO - min/max exclusive is not supported
            assert.equal(convertedLfData.items[12].restrictions.minInclusive, 5);
            assert.equal(convertedLfData.items[14].restrictions.maxInclusive, 10);
            assert.equal(convertedLfData.items[21].restrictions.minLength, 5);
            assert.equal(convertedLfData.items[22].restrictions.maxLength, 10);
          });

          it('should convert only valid restrictions', function () {
            var lforms = angular.copy(window['restrictions_lforms']);
            var expected_fhirQ = angular.copy(window['restrictions_fhirQ'])
            var fhirQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, lforms);
            assert.deepEqual(fhirQ.item[0].extension, expected_fhirQ.item[0].extension);
            assert.deepEqual(fhirQ.item[1].extension, expected_fhirQ.item[1].extension);
            assert.equal(fhirQ.item[1].maxLength, expected_fhirQ.item[1].maxLength);
          });

          it('should convert externally defined', function () {
            var optionsRes = validationTestForm.items[23].externallyDefined;
            var fhirQ = fhir.SDC.convertLFormsToQuestionnaire(new LForms.LFormsData(validationTestForm));
            var convertedLfData = fhir.SDC.convertQuestionnaireToLForms(fhirQ);

            assert.equal(convertedLfData.items.length, 34);
            assert.equal(convertedLfData.items[23].externallyDefined, optionsRes);
          });
        });



        // export -xl
        describe('LForms data to Questionnaire conversion', function() {

          it('should convert to SDC Questionnaire with extensions', function() {
            var fhirQ = fhir.SDC.convertLFormsToQuestionnaire(new LForms.LFormsData(angular.copy(FHTData)));

            assert.equal(fhirQ.meta.profile[0], fhir.SDC.QProfile);
            assert.equal(fhirQ.item[0].item[1].extension[0].url, "http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs");
            assert.equal(fhirQ.item[0].item[1].extension[1].url, "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl");

          });

          it('should convert to standard Questionnaire without any extensions', function() {
            var fhirQ = fhir.SDC.convertLFormsToQuestionnaire(new LForms.LFormsData(angular.copy(FHTData)), true);

            assert.equal(fhirQ.meta.profile[0], fhir.SDC.stdQProfile);
            assert.equal(fhirQ.item[0].item[1].extension, undefined);

            assert.equal(fhirQ.toString().match(/extension/), undefined);

          });

          it('should covert a prefix of an item', function () {
            var item = {
              "questionCode": "12345",
              "prefix": "A:",
              "question": "fill in weight",
              "dataType": "ST"
            };
            var out = fhir.SDC._processItem(item, {});
            assert.equal(out.prefix, "A:");
            assert.equal(out.text, "fill in weight");
          });

          if(fhirVersion === 'STU3') {
            describe('argonaut samples', function () {
              it('should parse housing', function (done) {
                var file = 'test/data/STU3/argonaut-examples/housing.json';
                $.get(file, function(json) {
                  var lfData = LForms.Util.convertFHIRQuestionnaireToLForms(json, fhirVersion);
                  var convertedQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, lfData);
                  assert.equal(convertedQ.item[0].item[1].option.length, json.item[0].item[1].option.length);
                  assert.equal(convertedQ.item[0].item[2].option.length, json.item[0].item[2].option.length);

                  // valueString is changed to valueCoding.display
                  assert.equal(convertedQ.item[0].item[1].option[0].valueCoding.display, json.item[0].item[1].option[0].valueString);
                  done()
                }).fail(function (err) {
                  done(err);
                });
              });

              it('should parse sampler', function (done) {
                var file = 'test/data/STU3/argonaut-examples/sampler.json';
                $.get(file, function(json) {
                  var lfData = LForms.Util.convertFHIRQuestionnaireToLForms(json, fhirVersion);
                  var convertedQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, lfData);

                  assert.equal(convertedQ.item[11].item[0].option.length, json.item[11].item[0].option.length);
                  // The score is changed from argonaut extension to FHIR extension.
                  assert.equal(convertedQ.item[11].item[0].option[0].extension[0].url,
                      'http://hl7.org/fhir/StructureDefinition/questionnaire-ordinalValue');
                  assert.equal(convertedQ.item[11].item[0].option[0].extension[0].valueDecimal,
                      json.item[11].item[0].option[0].extension[0].valueDecimal);
                }).done(function () {
                  done();
                }).fail(function (err) {
                  done(err);
                });
              });
            });
          }
        });

        if (fhirVersion === 'R4') {
          describe('Conversion between R4 SDC Questionnaire and LForms', function () {
            it('should convert score value between R4 SDC Questionnaire and LForm format', function (done) {

              var file = 'test/data/R4/phq9.json';
              $.get(file, function (json) {
                try {
                  var lfData = LForms.Util.convertFHIRQuestionnaireToLForms(json, fhirVersion);
                  assert.equal(lfData.items[0].answers.length, json.item[0].answerOption.length);
                  assert.equal(lfData.items[0].answers[0].score, 0);
                  assert.equal(lfData.items[0].answers[0].text, "Not at all");
                  assert.equal(lfData.items[0].answers[0].codeSystem, "http://loinc.org");
                  assert.equal(lfData.items[0].answers[1].score, "1");
                  assert.equal(lfData.items[0].answers[1].text, "Several days");
                  assert.equal(lfData.items[0].answers[1].codeSystem, "http://loinc.org");

                  // convert it back to SDC Questionnaire
                  var newQ = LForms.Util.getFormFHIRData('Questionnaire', fhirVersion, lfData);

                  var answerOptionExt = LForms.Util.findObjectInArray(newQ.item[0].answerOption[0].extension, 'url', 'http://hl7.org/fhir/StructureDefinition/ordinalValue', 0, true);
                  assert.equal(answerOptionExt.length, 1)
                  answerOptionExt = LForms.Util.findObjectInArray(newQ.item[0].answerOption[1].extension, 'url', 'http://hl7.org/fhir/StructureDefinition/ordinalValue', 0, true);
                  assert.equal(answerOptionExt[0].valueDecimal, 1)
                  assert.equal(answerOptionExt[0].url, 'http://hl7.org/fhir/StructureDefinition/ordinalValue')
                  assert.equal(newQ.item[0].answerOption[1].valueCoding.system, "http://loinc.org")
                  assert.equal(newQ.item[0].answerOption[1].valueCoding.code, "LA6569-3")
                  assert.equal(newQ.item[0].answerOption[1].valueCoding.display, "Several days")
                }
                catch(err) {
                  done(err)
                }
              }).done(function () {
                done();
              }).fail(function (err) {
                console.log(': Unable to load ' + file);
                done(err);
              });
            });

            it('should convert coding instructions between R4 SDC Questionnaire and LForm format', function (done) {

              var file = 'test/data/R4/ussg-fhp.json';
              $.get(file, function (json) {
                try {
                  var lfData = LForms.Util.convertFHIRQuestionnaireToLForms(json, fhirVersion);

                  // name
                  assert.equal(lfData.items[0].items[0].codingInstructions, "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://google.com'>An html instruction on Name</a>");
                  assert.equal(lfData.items[0].items[0].codingInstructionsFormat, "html");
                  assert.equal(lfData.items[0].items[0].codingInstructionsPlain, "A plain text instruction on Name");
                  // gender
                  assert.equal(lfData.items[0].items[1].codingInstructions, "<code>Text</code> instructions, with a <button>button</button> and a link <a href='http://google.com'>An plain text instruction on Gender. HTML should be escaped.</a>");
                  assert.equal(lfData.items[0].items[1].codingInstructionsFormat, "text");
                  assert.equal(lfData.items[0].items[1].codingInstructionsPlain, "<code>Text</code> instructions, with a <button>button</button> and a link <a href='http://google.com'>An plain text instruction on Gender. HTML should be escaped.</a>");

                  var qData = LForms.Util.getFormFHIRData("Questionnaire", "R4", lfData);
                  // name
                  assert.equal(qData.item[0].item[0].item[0].text, "A plain text instruction on Name");
                  assert.equal(qData.item[0].item[0].item[0].type, "display");
                  assert.equal(qData.item[0].item[0].item[0].extension[0].url, "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl");
                  assert.equal(qData.item[0].item[0].item[0]._text.extension[0].url, "http://hl7.org/fhir/StructureDefinition/rendering-xhtml");
                  assert.equal(qData.item[0].item[0].item[0]._text.extension[0].valueString, "<code>HTML</code> instructions, with a <button>button</button> and a link <a href='http://google.com'>An html instruction on Name</a>");
                  // gender
                  assert.equal(qData.item[0].item[1].item[0].text, "<code>Text</code> instructions, with a <button>button</button> and a link <a href='http://google.com'>An plain text instruction on Gender. HTML should be escaped.</a>");
                  assert.equal(qData.item[0].item[1].item[0].type, "display");
                  assert.equal(qData.item[0].item[1].item[0].extension[0].url, "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl");
                  assert.equal(qData.item[0].item[1].item[0]._text, undefined);
                }
                catch(err) {
                  done(err)
                }
              }).done(function () {
                done();
              }).fail(function (err) {
                console.log(': Unable to load ' + file);
                done(err);
              });
            });

          });
        }

        describe('LForms data to QuestionnaireResponse conversion', function() {

          it('should convert to SDC Questionnaire with extensions', function() {
            var fhirQR = LForms.Util.getFormFHIRData('QuestionnaireResponse', fhirVersion, angular.copy(FHTData));

            assert.equal(fhirQR.meta.profile[0], fhir.SDC.QRProfile);

          });

          it('should convert to standard QuestionnaireResponse without any extensions', function() {
            var fhirQR = LForms.Util.getFormFHIRData(
              'QuestionnaireResponse', fhirVersion, angular.copy(FHTData),
              {noExtensions: true});

            assert.equal(fhirQR.meta.profile[0], fhir.SDC.stdQRProfile);

            assert.equal(fhirQR.toString().match(/extension/), undefined);

          });

          it('should covert an item of QTY to valueQuantity in FHIR QuestionnaireResponse', function () {
            var item = {
              "questionCodeSystem":"ad-hoc",
              "questionCode": "12345",
              "questionCardinality": {"min": "1", "max": "1"},
              "question": "fill in weight",
              "dataType": "QTY",
              "_codePath": "/weight",
              "value": 128
            };
            var out = fhir.SDC._processResponseItem(item, {});
            assert.equal(out.linkId, "/weight");
            assert.equal(out.answer[0].valueQuantity.value, 128);
          });
        });

        // import - xl
        describe('Load/convert/merge FHIR questionnaire/response into LForms data', function() {
          it('FHIR quantity should become LForms QTY with correct value from QuestionnaireResponse', function () {
            var qFile = 'test/data/' + fhirVersion + '/fhir-valueQuantity-questionnaire.json';
            var qrFile = 'test/data/' + fhirVersion + '/fhir-valueQuantity-qn-response.json';

            // Test loading FHIR Questionnaire QuestionnaireResponse for it, then merge into an lforms.
            $.get(qFile, function(fhirQnData) { // load the questionnaire json
              $.get(qrFile, function(fhirQnRespData) { // load the questionnaire response json
                var qnForm = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQnData, fhirVersion);
                var mergedFormData = LForms.Util.mergeFHIRDataIntoLForms(
                    'QuestionnaireResponse', fhirQnRespData, qnForm, fhirVersion);
                assert.equal(mergedFormData.items[0].value, 333.0);
                assert.equal(mergedFormData.items[0].dataType, 'QTY');
              }).done().fail(function(err){console.log('Unable to load ' + qrFile);});
            }).done().fail(function(err){console.log('Unable to load ' + qFile);});
          });
        });

        describe('Questionnaire contained ValueSet', function() {
          var qnForm;
          before(function(done) {
            var qFile = 'test/data/' + fhirVersion + '/argonaut-phq9-ish.json';
            $.get(qFile, function(fhirQnData) { // load the questionnaire json
              qnForm = LForms.Util.convertFHIRQuestionnaireToLForms(fhirQnData, fhirVersion);
              qnForm = new LForms.LFormsData(qnForm);
              done();
            }).fail(function(err){
              done(new Error('Unable to load ' + qFile + ': ' + err.statusText + ' (' + err.status + ')'));
            });
          });
  
          it('should properly convert to LForms answers', function () {
            var item = LForms.Util.findItem(qnForm.items, 'linkId', 'g1.q2');
            assert.equal(item.questionCode, '44255-8');
            assert.equal(item.dataType, 'CNE');
            assert.equal(item.answers[1].code, 'LA6569-3');
            assert.equal(item.answers[1].text, 'Several days');
            assert.equal(item.answers[1].score, 1);
          });
        });
      });
    });
  })(fhirVersions[i]);
}

var nonSTU3FHIRVersions = fhirVersions.slice();
nonSTU3FHIRVersions.splice(nonSTU3FHIRVersions.indexOf('STU3'), 1);
for (var i=0, len=nonSTU3FHIRVersions.length; i<len; ++i) {
  (function (fhirVersion) {
    var fhir = LForms.FHIR[fhirVersion];
    describe(fhirVersion, function() {
      describe('FHIR SDC library', function() {
        describe('LForms data to Questionnaire conversion', function() {
          it('should handle FHIRPath extensions', function() {
            // Try converting a questionnaire to LForms and then convert it
            // back.
            var fhirQ = {
              "resourceType": "Questionnaire",
              "item": [
                {
                  "extension": [
                    {
                      "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-initialExpression",
                      "valueExpression": {
                        "description": "initial BMI",
                        "language" : "text/fhirpath",
                        "expression": "1"
                      }
                    },
                    {
                      "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-calculatedExpression",
                      "valueExpression": {
                        "description": "BMI calculation",
                        "language" : "text/fhirpath",
                        "expression": "item.where(linkId='/29463-7').answer.valueQuantity.value/item.where(linkId='/8302-2').answer.valueQuantity.value/item.where(linkId='/8302-2').answer.valueQuantity.value/0.0254/0.0254"
                      }
                    },
                    {
                      "url": "http://hl7.org/fhir/StructureDefinition/variable",
                      "valueExpression": {
                        "name": "var1",
                        "language" : "text/fhirpath",
                        "expression": "-5"
                      }
                    },
                    {
                      "url": "http://hl7.org/fhir/StructureDefinition/variable",
                      "valueExpression": {
                        "name": "var2",
                        "language" : "text/fhirpath",
                        "expression": "-4"
                      }
                    }
                  ],
                  "linkId": "/39156-5",
                  "code": [
                    {
                      "system": "http://loinc.org",
                      "code": "39156-5",
                      "display": "BMI"
                    }
                  ],
                  "text": "BMI",
                  "type": "decimal"
                }
              ]
            };
            var lformsQ = new LForms.LFormsData(fhir.SDC.convertQuestionnaireToLForms(fhirQ));
            assert.isOk(lformsQ.items[0]._variableExt);
            assert.equal(lformsQ.items[0]._variableExt.length, 2);
            var convertedFHIRQ = fhir.SDC.convertLFormsToQuestionnaire(lformsQ);
            // Confirm that we got the exension back.
            var fhirQExts = fhirQ.item[0].extension;
            var convertedExts = convertedFHIRQ.item[0].extension;
            // After the conversion, the order of extension array might change,
            // but atleast make sure the content of each element is the same.
            assert.equal(convertedExts.length, fhirQExts.length);
            for (var i=0, len=convertedExts.length; i<len; ++i) {
              assert.isOk(fhirQExts.some(function(qExt) {
                return JSON.stringify(convertedExts[i]) === JSON.stringify(qExt);
              }));
            }
          });
        });
      });
    });
  })(nonSTU3FHIRVersions[i]);
}


